import { describe, it, expect } from "vitest";
import { MAX_TIERS, validatePromotionBonus, validateTiers } from "./sandboxTiers";

describe("validateTiers", () => {
  it("accepts an ordered list and returns numbers", () => {
    const result = validateTiers([
      { stars: "5", cp: "50" },
      { stars: "15", cp: "100" },
      { stars: "50", cp: "300" },
    ]);
    expect(result).toEqual({
      ok: true,
      tiers: [
        { stars: 5, cp: 50 },
        { stars: 15, cp: 100 },
        { stars: 50, cp: 300 },
      ],
    });
  });

  it("accepts an empty list — the feature is inert until configured", () => {
    expect(validateTiers([])).toEqual({ ok: true, tiers: [] });
  });

  it("accepts a milestone worth 0 CP", () => {
    expect(validateTiers([{ stars: "5", cp: "0" }])).toEqual({ ok: true, tiers: [{ stars: 5, cp: 0 }] });
  });

  it("rejects a threshold equal to the previous one", () => {
    const result = validateTiers([
      { stars: "5", cp: "50" },
      { stars: "5", cp: "100" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/strictly increase/);
  });

  it("rejects a threshold lower than the previous one", () => {
    const result = validateTiers([
      { stars: "15", cp: "100" },
      { stars: "5", cp: "50" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Milestone 2/);
  });

  it("rejects a blank, non-numeric or fractional threshold", () => {
    expect(validateTiers([{ stars: "", cp: "50" }]).ok).toBe(false);
    expect(validateTiers([{ stars: "many", cp: "50" }]).ok).toBe(false);
    expect(validateTiers([{ stars: "5.5", cp: "50" }]).ok).toBe(false);
  });

  it("rejects a threshold at zero or below", () => {
    expect(validateTiers([{ stars: "0", cp: "50" }]).ok).toBe(false);
    expect(validateTiers([{ stars: "-5", cp: "50" }]).ok).toBe(false);
  });

  it("rejects a blank or negative CP reward", () => {
    expect(validateTiers([{ stars: "5", cp: "" }]).ok).toBe(false);
    expect(validateTiers([{ stars: "5", cp: "-1" }]).ok).toBe(false);
  });

  it("rejects more milestones than the schema allows", () => {
    const rows = Array.from({ length: MAX_TIERS + 1 }, (_, i) => ({
      stars: String(i + 1),
      cp: "10",
    }));
    const result = validateTiers(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/At most 20/);
  });
});

describe("validatePromotionBonus", () => {
  it("accepts a whole number, zero included", () => {
    expect(validatePromotionBonus("200")).toEqual({ ok: true, value: 200 });
    expect(validatePromotionBonus("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects a blank, fractional or negative value", () => {
    expect(validatePromotionBonus("").ok).toBe(false);
    expect(validatePromotionBonus("12.5").ok).toBe(false);
    expect(validatePromotionBonus("-1").ok).toBe(false);
  });

  it("rejects a value above the cap", () => {
    const result = validatePromotionBonus("100001");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot exceed/);
  });
});
