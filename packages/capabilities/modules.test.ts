import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { z } from "zod";
import type { ModuleSetting } from "../database-service/repositories/moduleSetting.repo.js";
import { PlatformRegistry } from "../registry/platform.js";
import {
  createModules,
  ModuleNotFoundError,
  ModuleSettingsError,
  ownerEnabled,
  type ModuleSettingStore,
} from "./modules.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

function memoryStore(rows: ModuleSetting[] = []): ModuleSettingStore & { rows: Map<string, ModuleSetting> } {
  const map = new Map(rows.map((row) => [row.key, row]));
  return {
    rows: map,
    find: async (key) => map.get(key) ?? null,
    findAll: async () => [...map.values()],
    save: async (key, state, updatedBy) => {
      const row = { key, ...state, updated_at: new Date(), updated_by: updatedBy };
      map.set(key, row);
      return row;
    },
  };
}

beforeEach(() => {
  PlatformRegistry.reset();
  PlatformRegistry.install({
    flows: [{ descriptor: descriptor("code") }],
    modules: [
      { key: "sandbox", label: "Sandbox", defaultEnabled: true },
      {
        key: "digest",
        label: "Digest",
        settings: { schema: z.object({ frequency_days: z.number().int().min(1).max(365).default(7) }) },
      },
    ],
  });
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("modules", () => {
  it("falls back to each module's declared defaults without a stored row", async () => {
    const modules = createModules(memoryStore());

    expect(await modules.all()).toEqual([
      { key: "sandbox", label: "Sandbox", description: null, enabled: true, settings: {}, updatedAt: null },
      { key: "digest", label: "Digest", description: null, enabled: false, settings: { frequency_days: 7 }, updatedAt: null },
    ]);
  });

  it("reads the stored state over the defaults", async () => {
    const modules = createModules(memoryStore([
      { key: "sandbox", enabled: false, settings: {}, updated_at: new Date(), updated_by: null },
      { key: "digest", enabled: true, settings: { frequency_days: 14 }, updated_at: new Date(), updated_by: "admin-1" },
    ]));

    expect(await modules.enabled("sandbox")).toBe(false);
    expect(await modules.settings("digest")).toEqual({ frequency_days: 14 });
  });

  it("answers disabled and empty for a module that is not installed", async () => {
    const modules = createModules(memoryStore());

    expect(await modules.state("meetings")).toBeNull();
    expect(await modules.enabled("meetings")).toBe(false);
    expect(await modules.settings("meetings")).toEqual({});
  });

  it("merges and validates settings on update, keeping the current state", async () => {
    const store = memoryStore([{ key: "digest", enabled: true, settings: { frequency_days: 14 }, updated_at: new Date(), updated_by: null }]);
    const modules = createModules(store);

    const updated = await modules.update("digest", { settings: { frequency_days: 30 } }, "admin-1");

    expect(updated).toMatchObject({ enabled: true, settings: { frequency_days: 30 } });
    expect(store.rows.get("digest")?.updated_by).toBe("admin-1");
  });

  it("refuses invalid settings and unknown modules", async () => {
    const modules = createModules(memoryStore());

    await expect(modules.update("digest", { settings: { frequency_days: 0 } }, null)).rejects.toThrow(ModuleSettingsError);
    await expect(modules.update("meetings", { enabled: true }, null)).rejects.toThrow(ModuleNotFoundError);
  });

  it("falls back to defaults when stored settings no longer parse", async () => {
    const modules = createModules(memoryStore([
      { key: "digest", enabled: true, settings: { frequency_days: "weekly" }, updated_at: new Date(), updated_by: null },
    ]));
    const warn = console.warn;
    console.warn = () => {};

    expect(await modules.settings("digest")).toEqual({ frequency_days: 7 });
    console.warn = warn;
  });
});

describe("ownerEnabled", () => {
  it("only lets an installed module be disabled", async () => {
    const modules = createModules(memoryStore([{ key: "digest", enabled: false, settings: {}, updated_at: new Date(), updated_by: null }]));

    expect(await ownerEnabled("flow:code", modules)).toBe(true);
    expect(await ownerEnabled("core", modules)).toBe(true);
    expect(await ownerEnabled("module:unknown", modules)).toBe(true);
    expect(await ownerEnabled("module:digest", modules)).toBe(false);
    expect(await ownerEnabled("module:sandbox", modules)).toBe(true);
  });
});
