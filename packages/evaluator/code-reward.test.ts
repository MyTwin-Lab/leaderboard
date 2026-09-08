import { describe, it, expect } from "vitest";
import { computeCodeAward, type CodeAwardInput } from "./code-reward.js";

const RULES = { version: 1 as const, delivery: { fixed: 50, cap: 150 } };

function makeInput(over: Partial<CodeAwardInput> = {}): CodeAwardInput {
  return {
    rules: RULES,
    challengeId: "ch-1",
    userId: "alice",
    contributionId: "contrib-1",
    score: 8,
    alreadyAwarded: { code_fixed: 0, code_quality: 0 },
    remainingPool: 1000,
    ...over,
  };
}

describe("computeCodeAward", () => {
  it("first successful run pays fixed + cap × score/10", () => {
    const drafts = computeCodeAward(makeInput());
    expect(drafts).toHaveLength(2);
    const fixed = drafts.find(d => d.rule_key === "code_fixed")!;
    const quality = drafts.find(d => d.rule_key === "code_quality")!;
    expect(fixed.points).toBe(50);
    expect(quality.points).toBe(120); // 150 × 8/10
    expect(quality.meta?.agentScore).toBe(8);
    expect(quality.meta?.rawPoints).toBe(120);
  });

  it("re-run with a better score pays only the quality delta", () => {
    const drafts = computeCodeAward(makeInput({
      score: 9,
      alreadyAwarded: { code_fixed: 50, code_quality: 120 },
    }));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rule_key).toBe("code_quality");
    expect(drafts[0].points).toBe(15); // 135 − 120
  });

  it("re-run with a worse score pays nothing and never claws back", () => {
    const drafts = computeCodeAward(makeInput({
      score: 5,
      alreadyAwarded: { code_fixed: 50, code_quality: 120 },
    }));
    expect(drafts).toHaveLength(0);
  });

  it("clamps to the remaining pool, fixed first", () => {
    const drafts = computeCodeAward(makeInput({ remainingPool: 60 }));
    const fixed = drafts.find(d => d.rule_key === "code_fixed")!;
    const quality = drafts.find(d => d.rule_key === "code_quality")!;
    expect(fixed.points).toBe(50);
    expect(quality.points).toBe(10);
    expect(quality.meta?.clampedTo).toBe(10);
  });

  it("empty pool produces no rows at all", () => {
    expect(computeCodeAward(makeInput({ remainingPool: 0 }))).toHaveLength(0);
  });

  it("clamps score into [0, 10]", () => {
    const drafts = computeCodeAward(makeInput({ score: 14 }));
    expect(drafts.find(d => d.rule_key === "code_quality")!.points).toBe(150);
    const low = computeCodeAward(makeInput({ score: -2 }));
    expect(low.find(d => d.rule_key === "code_quality")).toBeUndefined();
  });

  it("zero-score run still pays the fixed part once", () => {
    const drafts = computeCodeAward(makeInput({ score: 0 }));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rule_key).toBe("code_fixed");
  });
});

describe("computeCodeAward — group bonus", () => {
  it("leaves a solo delivery untouched", () => {
    // Le multiplicateur par défaut doit être strictement neutre : c'est ce qui
    // rend le chantier groupes invisible pour les participations existantes.
    const solo = computeCodeAward(makeInput());
    const explicit = computeCodeAward(makeInput({ groupMultiplier: 1 }));
    expect(explicit).toEqual(solo);
  });

  it("pays a pair 140% of the solo award", () => {
    const drafts = computeCodeAward(makeInput({ groupMultiplier: 1.4 }));
    expect(drafts.find(d => d.rule_key === "code_fixed")!.points).toBe(70);   // 50 × 1.4
    expect(drafts.find(d => d.rule_key === "code_quality")!.points).toBe(168); // 120 × 1.4
  });

  it("costs the pool less than the same contributors working solo", () => {
    const solo = computeCodeAward(makeInput()).reduce((s, d) => s + d.points, 0);
    const pair = computeCodeAward(makeInput({ groupMultiplier: 1.4 })).reduce((s, d) => s + d.points, 0);
    const trio = computeCodeAward(makeInput({ groupMultiplier: 1.8 })).reduce((s, d) => s + d.points, 0);
    expect(pair).toBeLessThan(solo * 2);
    expect(trio).toBeLessThan(solo * 3);
  });

  it("reopens a delta when a member joins between two runs", () => {
    // Le brut monte avec la taille du groupe, le déjà-versé est lu tel quel au
    // ledger : l'écart est versé au run suivant. Comportement voulu — rien
    // n'est repris, seul le complément est payé.
    const drafts = computeCodeAward(makeInput({
      groupMultiplier: 1.4,
      alreadyAwarded: { code_fixed: 50, code_quality: 120 }, // versés en solo
    }));
    expect(drafts.find(d => d.rule_key === "code_fixed")!.points).toBe(20);   // 70 − 50
    expect(drafts.find(d => d.rule_key === "code_quality")!.points).toBe(48); // 168 − 120
  });

  it("pays nothing more when the group shrinks back", () => {
    // La réciproque : un brut plus bas que le déjà-versé donne un delta nul,
    // jamais une reprise de points.
    const drafts = computeCodeAward(makeInput({
      groupMultiplier: 1,
      alreadyAwarded: { code_fixed: 70, code_quality: 168 },
    }));
    expect(drafts).toHaveLength(0);
  });

  it("still clamps the bonus to the remaining pool", () => {
    const drafts = computeCodeAward(makeInput({ groupMultiplier: 1.8, remainingPool: 60 }));
    expect(drafts.reduce((s, d) => s + d.points, 0)).toBe(60);
    expect(drafts[0].meta?.clampedTo).toBe(60);
  });
});
