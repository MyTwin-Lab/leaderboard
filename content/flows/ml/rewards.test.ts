import { describe, it, expect, vi } from "vitest";
import type { Challenge, RewardEntry } from "../../../packages/database-service/domain/entities.js";
import { ML_PUBLIC_REWARD_FIELDS, summarizeMlRewards } from "./rewards.js";

/** Des règles ML valides au sens du schéma : le résumé passe par parseMlRewardRules. */
function mlRules(metric: { name: string; baseline: number; blockThreshold?: number }) {
  return {
    version: 1,
    dataset: { cap: 300 },
    model: { cap: 500, metric, beatBestBonus: 50 },
    apiPackaging: { cap: 200 },
    reuse: { datasetShare: 0.2, modelShare: 0.2 },
  };
}

function entry(user_id: string, rule_key: string, meta: Record<string, unknown> | null): RewardEntry {
  return { uuid: `${user_id}-${Math.random()}`, user_id, rule_key, points: 10, meta, challenge_id: "c-1", created_at: new Date() } as RewardEntry;
}

function summarize(reward_rules: unknown, entries: RewardEntry[] = [], best: number | null = null) {
  const maxMetaNumber = vi.fn(async () => best);
  const challenge = { uuid: "c-1", type: "ml", reward_rules } as Challenge;
  return { result: summarizeMlRewards({ challenge, entries, maxMetaNumber }), maxMetaNumber };
}

describe("summarizeMlRewards", () => {
  it("has no metric without reward rules", async () => {
    const { result, maxMetaNumber } = summarize(null, [entry("u1", "model_metric", { metricValue: 0.9 })]);

    expect(await result).toEqual({ rules: null, metric: null, bestValue: null, thresholdReached: false });
    expect(maxMetaNumber).not.toHaveBeenCalled();
  });

  it("builds the beat-the-leader timeline from each contributor's best model_metric entry", async () => {
    const { result } = summarize(mlRules({ name: "accuracy", baseline: 0.5 }), [
      entry("u1", "model_metric", { metricValue: 0.7 }),
      entry("u1", "model_metric", { metricValue: 0.9 }),
      entry("u2", "model_metric", { metricValue: 0.8 }),
      entry("u3", "dataset", { metricValue: 0.99 }),
    ]);

    expect((await result).metric).toEqual({ name: "accuracy", baseline: 0.5, points: [0.9, 0.8] });
  });

  it("reads the best value the way the submission gate does", async () => {
    const { result, maxMetaNumber } = summarize(mlRules({ name: "auc", baseline: 0.5 }), [], 0.87);

    expect((await result).bestValue).toBe(0.87);
    expect(maxMetaNumber).toHaveBeenCalledWith({ ruleKey: "model_metric", field: "metricValue" });
  });

  it("flags thresholdReached once the best metric meets the block threshold", async () => {
    expect((await summarize(mlRules({ name: "auc", baseline: 0.5, blockThreshold: 0.9 }), [], 0.9).result).thresholdReached).toBe(true);
    expect((await summarize(mlRules({ name: "auc", baseline: 0.5, blockThreshold: 0.9 }), [], 0.85).result).thresholdReached).toBe(false);
  });

  it("never flags thresholdReached without a threshold", async () => {
    expect((await summarize(mlRules({ name: "auc", baseline: 0.5 }), [], 0.99).result).thresholdReached).toBe(false);
  });

  it("publishes only the timeline and the best value", () => {
    expect([...ML_PUBLIC_REWARD_FIELDS]).toEqual(["metric", "bestValue"]);
  });
});
