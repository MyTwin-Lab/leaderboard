import { describe, it, expect } from "vitest";
import { sandboxModule } from "./index.js";
import { sandboxSettingsSchema } from "./settings.js";

describe("sandbox module settings", () => {
  it("is declared by the module, and defaults to an inert economy", () => {
    expect(sandboxModule.settings?.schema).toBe(sandboxSettingsSchema);
    expect(sandboxSettingsSchema.parse({})).toEqual({ star_tiers: [], promotion_bonus_cp: 0 });
  });

  it("keeps the rules of the former admin settings", () => {
    expect(
      sandboxSettingsSchema.parse({ star_tiers: [{ stars: 5, cp: 50 }, { stars: 15, cp: 100 }], promotion_bonus_cp: 200 }),
    ).toEqual({ star_tiers: [{ stars: 5, cp: 50 }, { stars: 15, cp: 100 }], promotion_bonus_cp: 200 });

    expect(sandboxSettingsSchema.safeParse({ star_tiers: [{ stars: 15, cp: 100 }, { stars: 5, cp: 50 }] }).success).toBe(false);
    expect(sandboxSettingsSchema.safeParse({ promotion_bonus_cp: 1_000_000 }).success).toBe(false);
  });
});
