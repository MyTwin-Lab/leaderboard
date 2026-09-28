import { describe, it, expect } from "vitest";
import {
  QUALITY_LAG,
  annotatorQuality,
  clearsSensitive,
  labelPay,
  resolveConsensus,
  tallyOf,
  type LabeledClaim,
} from "./scoring.js";
import { annotationConfigSchema, annotationRulesSchema, parseAnnotationRules } from "./config.js";

const gold = (value: string, expected: string): LabeledClaim => ({
  resource_type: "gold", payload: { image_url: "https://x/g.png", expected }, result: { value },
});
const item = (value: string): LabeledClaim => ({ resource_type: "item", payload: { image_url: "https://x/i.png" }, result: { value } });

describe("resolveConsensus", () => {
  it.each([
    [["a", "a", "b"], { verdict: "labeled", consensus: "a" }],
    [["a"], { verdict: "labeled", consensus: "a" }],
    [["a", "b", "c"], { verdict: "contested" }],
    // k = 5 : ni majorité, ni « tous différents ».
    [["a", "a", "b", "b", "c"], { verdict: "contested" }],
    [["a", "a", "b", "c", "d"], { verdict: "labeled", consensus: "a" }],
    [[], { verdict: "contested" }],
  ])("%j → %j", (values, expected) => {
    expect(resolveConsensus(values)).toEqual(expected);
  });

  it("tallies labels", () => {
    expect(tallyOf(["a", "b", "a"])).toEqual({ a: 2, b: 1 });
  });
});

describe("annotatorQuality", () => {
  it("is null until a gold counts", () => {
    expect(annotatorQuality([item("a"), item("b")], 0)).toEqual({ goldSeen: 0, goldCorrect: 0, accuracy: null });
  });

  it("sums the correct golds, items ignored", () => {
    const claims = [gold("a", "a"), item("b"), gold("b", "a"), gold("c", "c")];
    expect(annotatorQuality(claims, 0)).toEqual({ goldSeen: 3, goldCorrect: 2, accuracy: 2 / 3 });
  });

  it("ignores the most recent labels, so a score change cannot be pinned on one image", () => {
    const recentGold = gold("wrong", "a");
    const older = Array.from({ length: QUALITY_LAG }, () => item("x"));
    const oldGold = gold("a", "a");

    // Le gold raté vient d'être labellisé : il ne compte pas encore.
    expect(annotatorQuality([recentGold, ...older.slice(1), oldGold]).accuracy).toBe(1);
    // Dix labels plus tard, il compte.
    expect(annotatorQuality([...older, recentGold, oldGold]).accuracy).toBe(0.5);
  });
});

describe("clearsSensitive", () => {
  const clearance = { min_seen: 3, min_accuracy: 0.8 };
  it("needs enough golds and enough accuracy", () => {
    expect(clearsSensitive({ goldSeen: 2, goldCorrect: 2, accuracy: 1 }, clearance)).toBe(false);
    expect(clearsSensitive({ goldSeen: 5, goldCorrect: 3, accuracy: 0.6 }, clearance)).toBe(false);
    expect(clearsSensitive({ goldSeen: 5, goldCorrect: 4, accuracy: 0.8 }, clearance)).toBe(true);
  });
});

describe("labelPay", () => {
  it("pays the full unit while no gold counts", () => {
    expect(labelPay(10, { goldSeen: 0, goldCorrect: 0, accuracy: null }, 100)).toBe(10);
  });
  it("weights by accuracy, rounded", () => {
    expect(labelPay(10, { goldSeen: 3, goldCorrect: 2, accuracy: 2 / 3 }, 100)).toBe(7);
  });
  it("is clamped to the remaining pool", () => {
    expect(labelPay(10, { goldSeen: 0, goldCorrect: 0, accuracy: null }, 4)).toBe(4);
    expect(labelPay(10, { goldSeen: 0, goldCorrect: 0, accuracy: null }, 0)).toBe(0);
  });
});

describe("configuration", () => {
  const labelSchema = { kind: "single_choice", options: [{ key: "benign", label: "Benign" }, { key: "malignant", label: "Malignant" }] };

  it("fills the defaults around the label schema", () => {
    expect(annotationConfigSchema.parse({ label_schema: labelSchema })).toEqual({
      k: 3,
      ttl_hours: 48,
      label_schema: labelSchema,
      sensitive_clearance: { min_seen: 5, min_accuracy: 0.8 },
    });
  });

  it("refuses an even k, a missing label schema and duplicate option keys", () => {
    expect(() => annotationConfigSchema.parse({ k: 4, label_schema: labelSchema })).toThrow();
    expect(() => annotationConfigSchema.parse({})).toThrow();
    expect(() => annotationConfigSchema.parse({
      label_schema: { kind: "single_choice", options: [{ key: "a", label: "A" }, { key: "a", label: "B" }] },
    })).toThrow();
  });

  it("parses the reward rules, or refuses them", () => {
    expect(annotationRulesSchema.parse({ per_unit_cp: 4 })).toEqual({ per_unit_cp: 4, gold_rate: 0.1, audit_rate: 0.1 });
    expect(parseAnnotationRules({ per_unit_cp: -1 })).toBeNull();
    expect(parseAnnotationRules({ per_unit_cp: 2, gold_rate: 2 })).toBeNull();
  });
});
