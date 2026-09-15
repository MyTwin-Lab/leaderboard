import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PlatformRegistry, type ConfigSchema, type PlatformDefinitions } from "../registry/platform.js";
import {
  extensionConfigOf,
  flowConfigOf,
  FlowConfigError,
  parseFlowRules,
  patchExtensionConfig,
  planFlowConfigUpgrade,
  prepareFlowConfig,
  readFlowConfig,
} from "./flow-config.js";

/** Un schéma minimal : vérifie un entier `seats` et pose un défaut. */
const seatsSchema: ConfigSchema = {
  parse(value) {
    const config = value as { seats?: unknown };
    const seats = config.seats ?? 1;
    if (typeof seats !== "number" || !Number.isInteger(seats)) throw new Error("seats must be an integer");
    return { seats };
  },
};

const gpuSchema: ConfigSchema = {
  parse(value) {
    const config = value as { enabled?: unknown; quota?: unknown };
    return { enabled: config.enabled === true, quota: typeof config.quota === "number" ? config.quota : 1 };
  },
};

const DISTRIBUTION: PlatformDefinitions = {
  flows: [
    {
      descriptor: { key: "room", label: "Room", longLabel: "Room", icon: "code", briefRequired: false, publiclyVisible: true },
      // v1 : { places } ; v2 : { seats }
      config: { version: 2, schema: seatsSchema, upgrades: { 1: ({ places, ...rest }) => ({ ...rest, seats: places }) } },
      rules: { parse: (raw) => ((raw as { ok?: boolean }).ok ? raw : null) },
    },
    {
      descriptor: { key: "bare", label: "Bare", longLabel: "Bare", icon: "code", briefRequired: false, publiclyVisible: true },
    },
  ],
  extensions: [{ key: "gpu", appliesTo: ["room"], config: { schema: gpuSchema, editableKeys: ["enabled"] } }],
};

describe("flow-config", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install(DISTRIBUTION);
  });
  afterEach(() => PlatformRegistry.reset());

  describe("readFlowConfig", () => {
    it("upgrades an older config in memory, with the extension sections validated", () => {
      const reading = readFlowConfig({
        type: "room",
        flow_config: { places: 4, extensions: { gpu: { enabled: true } } },
        flow_config_version: 1,
      });

      expect(reading).toEqual({
        state: "current",
        version: 2,
        storedVersion: 1,
        config: { seats: 4, extensions: { gpu: { enabled: true, quota: 1 } } },
      });
    });

    it("keeps the section of an extension that is no longer installed", () => {
      const config = flowConfigOf({ type: "room", flow_config: { seats: 2, extensions: { retired: { a: 1 } } }, flow_config_version: 2 });

      expect(config?.extensions).toEqual({ retired: { a: 1 }, gpu: { enabled: false, quota: 1 } });
    });

    it("does not read a config newer than the installed flow, nor one of an unknown flow", () => {
      expect(readFlowConfig({ type: "room", flow_config: { seats: 2 }, flow_config_version: 3 }))
        .toEqual({ state: "newer", storedVersion: 3, version: 2 });
      expect(readFlowConfig({ type: "gone", flow_config: {} })).toEqual({ state: "unknown_flow", flowKey: "gone" });
      expect(flowConfigOf({ type: "gone", flow_config: {} })).toBeNull();
    });

    it("reports an invalid config instead of throwing", () => {
      const reading = readFlowConfig({ type: "room", flow_config: { seats: "many" }, flow_config_version: 2 });

      expect(reading).toEqual({ state: "invalid", error: "seats must be an integer" });
    });

    it("passes the config of a flow without schema through, at version 1", () => {
      expect(flowConfigOf({ type: "bare", flow_config: { free: true } })).toEqual({ free: true });
    });
  });

  describe("prepareFlowConfig", () => {
    it("validates a new config and stores it in the current version", () => {
      expect(prepareFlowConfig("room", { seats: 3, extensions: { gpu: { enabled: true } } })).toEqual({
        flow_config: { seats: 3, extensions: { gpu: { enabled: true, quota: 1 } } },
        flow_config_version: 2,
      });
    });

    it("drops the section of an installed extension the flow does not use", () => {
      expect(prepareFlowConfig("bare", { extensions: { gpu: { enabled: true } } })).toEqual({
        flow_config: {},
        flow_config_version: 1,
      });
    });

    it("refuses an unknown flow and an invalid config", () => {
      expect(() => prepareFlowConfig("gone", {})).toThrow(FlowConfigError);
      expect(() => prepareFlowConfig("room", { seats: 1.5 })).toThrow(/Invalid room configuration: seats must be an integer/);
    });
  });

  describe("patchExtensionConfig", () => {
    const challenge = { type: "room", flow_config: { places: 2 }, flow_config_version: 1 };

    it("changes an editable key, and writes the whole config in the current version", () => {
      expect(patchExtensionConfig(challenge, "gpu", { enabled: true })).toEqual({
        flow_config: { seats: 2, extensions: { gpu: { enabled: true, quota: 1 } } },
        flow_config_version: 2,
      });
      expect(extensionConfigOf(challenge, "gpu")).toEqual({ enabled: false, quota: 1 });
    });

    it("refuses a key locked after creation", () => {
      expect(() => patchExtensionConfig(challenge, "gpu", { quota: 8 })).toThrow(/quota cannot be changed after creation/);
    });

    it("has nothing to change when the extension does not attach to the flow", () => {
      expect(patchExtensionConfig({ type: "bare", flow_config: {} }, "gpu", { enabled: true })).toBeNull();
    });
  });

  describe("planFlowConfigUpgrade", () => {
    it("plans the write of an upgraded config, and nothing for an up-to-date one", () => {
      expect(planFlowConfigUpgrade({ type: "room", flow_config: { places: 5 }, flow_config_version: 1 })).toEqual({
        state: "upgraded",
        from: 1,
        stored: { flow_config: { seats: 5, extensions: { gpu: { enabled: false, quota: 1 } } }, flow_config_version: 2 },
      });
      expect(planFlowConfigUpgrade({ type: "room", flow_config: { seats: 5 }, flow_config_version: 2 })).toEqual({
        state: "up_to_date",
      });
    });

    it("skips, with a reason, what it cannot upgrade", () => {
      expect(planFlowConfigUpgrade({ type: "gone", flow_config: {} })).toMatchObject({ state: "skipped" });
      expect(planFlowConfigUpgrade({ type: "room", flow_config: { places: "x" }, flow_config_version: 1 }))
        .toEqual({ state: "skipped", reason: "seats must be an integer" });
    });
  });

  describe("parseFlowRules", () => {
    it("reads rules with the parser of the flow, and accepts clearing them", () => {
      expect(parseFlowRules("room", { ok: true })).toEqual({ ok: true, rules: { ok: true } });
      expect(parseFlowRules("room", null)).toEqual({ ok: true, rules: null });
    });

    it("refuses rules the flow cannot read, or a flow without rules", () => {
      expect(parseFlowRules("room", { ok: false })).toEqual({ ok: false });
      expect(parseFlowRules("bare", { anything: 1 })).toEqual({ ok: false });
    });
  });
});
