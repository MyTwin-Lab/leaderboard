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
