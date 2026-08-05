import { describe, it, expect } from "vitest";
import { computeMlAward, normalizeMetric, simulateMaxDistribution } from "../ml-reward.js";
import type { MlAwardInput } from "../ml-reward.js";
import type { MlRewardRules } from "../../database-service/domain/mlRewardRules.js";

const RULES: MlRewardRules = {
  version: 1,
  dataset: { cap: 300 },
  model: {
    cap: 500,
    kaggleShare: 0.5,
    metric: { name: "auc", baseline: 0 },
    beatBestBonus: 50,
  },
  apiPackaging: { cap: 200 },
  reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
};

const base = (over: Partial<MlAwardInput> = {}): MlAwardInput => ({
  rule: "dataset",
  rules: RULES,
  challengeId: "ch-1",
  userId: "bob",
  contributionId: "contrib-bob",
  remainingPool: 10_000,
  ...over,
});

describe("normalizeMetric", () => {
  it("passes the value through when there is no baseline", () => {
    expect(normalizeMetric(0.9, 0)).toBeCloseTo(0.9);
  });

  it("makes a coin-flip model worth zero when baseline is 0.5", () => {
    expect(normalizeMetric(0.5, 0.5)).toBe(0);
  });

  it("rescales above the baseline", () => {
    // 0.75 sits halfway between the 0.5 baseline and a perfect 1.0
    expect(normalizeMetric(0.75, 0.5)).toBeCloseTo(0.5);
  });

  it("clamps below-baseline values to zero rather than going negative", () => {
    expect(normalizeMetric(0.2, 0.5)).toBe(0);
  });

  it("still yields the full cap at a perfect metric", () => {
    expect(normalizeMetric(1, 0.5)).toBe(1);
  });
});

describe("computeMlAward — scoring", () => {
  it("scales the dataset cap by the agent score", () => {
    const [entry] = computeMlAward(base({ rule: "dataset", agentScore: 0.8 }));
    expect(entry.rule_key).toBe("dataset");
    expect(entry.points).toBe(240); // 300 * 0.8
    expect(entry.user_id).toBe("bob");
  });

  it("gives the Kaggle half in proportion to the metric, not as a flat grant", () => {
    const [entry] = computeMlAward(
      base({ rule: "model_metric", metricValue: 0.1, bestOtherMetricValue: 0.9 })
    );
    // 500 * 0.5 * 0.1 — a poor metric earns a fraction of the reserved half
    expect(entry.points).toBe(25);
  });

  it("awards the full Kaggle half at a perfect metric", () => {
    const entries = computeMlAward(
      base({ rule: "model_metric", metricValue: 1, bestOtherMetricValue: 0.99 })
    );
    expect(entries.find((e) => e.rule_key === "model_metric")!.points).toBe(250);
  });

  it("gives the GitHub half in proportion to the code agent score", () => {
    const [entry] = computeMlAward(base({ rule: "model_code", agentScore: 0.6 }));
    expect(entry.points).toBe(150); // 500 * 0.5 * 0.6
  });

  it("awards nothing on the GitHub half when there is no code score", () => {
    expect(computeMlAward(base({ rule: "model_code", agentScore: 0 }))).toEqual([]);
  });

  it("scales the API packaging cap by the agent score", () => {
    const [entry] = computeMlAward(base({ rule: "api_packaging", agentScore: 0.5 }));
    expect(entry.points).toBe(100);
  });

  it("applies the baseline so a coin-flip AUC earns nothing", () => {
    const rules: MlRewardRules = {
      ...RULES,
      model: { ...RULES.model, metric: { name: "auc", baseline: 0.5 } },
    };
    const entries = computeMlAward(
      base({ rule: "model_metric", rules, metricValue: 0.5, bestOtherMetricValue: null })
    );
    expect(entries).toEqual([]);
  });
});

describe("computeMlAward — beat best bonus", () => {
  const bonusFor = (over: Partial<MlAwardInput>) =>
    computeMlAward(base({ rule: "model_metric", ...over }))
      .find((e) => e.rule_key === "beat_best")?.points;

  it("awards the bonus for taking the lead from someone else", () => {
    expect(bonusFor({ metricValue: 0.95, bestOtherMetricValue: 0.9, myBestMetricValue: null })).toBe(50);
  });

  it("withholds the bonus when the metric does not beat the leader", () => {
    expect(bonusFor({ metricValue: 0.85, bestOtherMetricValue: 0.9, myBestMetricValue: null })).toBeUndefined();
  });

  it("withholds the bonus on an exact tie — a tie takes nobody's lead", () => {
    expect(bonusFor({ metricValue: 0.9, bestOtherMetricValue: 0.9, myBestMetricValue: null })).toBeUndefined();
  });

  it("awards the bonus to the first submitter, who leads by default", () => {
    expect(bonusFor({ metricValue: 0.7, bestOtherMetricValue: null, myBestMetricValue: null })).toBe(50);
  });

  it("withholds the bonus from a first submitter below the baseline", () => {
    const rules: MlRewardRules = {
      ...RULES,
      model: { ...RULES.model, metric: { name: "auc", baseline: 0.5 } },
    };
    expect(
      computeMlAward(base({ rule: "model_metric", rules, metricValue: 0.3, bestOtherMetricValue: null }))
    ).toEqual([]);
  });

  it("does not pay a leader for improving on their own score", () => {
    // Otherwise the bonus is farmable: submit 0.1, then 0.2, then 0.3 and
    // collect it each time, since points are never revoked.
    expect(bonusFor({ metricValue: 0.6, bestOtherMetricValue: null, myBestMetricValue: 0.5 })).toBeUndefined();
  });

  it("does not pay a leader for improving while still ahead of the field", () => {
    expect(bonusFor({ metricValue: 0.9, bestOtherMetricValue: 0.7, myBestMetricValue: 0.8 })).toBeUndefined();
  });

  it("pays again when a contributor takes back a lead they had lost", () => {
    // Bob led at 0.8, Alice overtook with 0.95, Bob answers with 0.96 —
    // that is a genuine second exploit, not self-improvement.
    expect(bonusFor({ metricValue: 0.96, bestOtherMetricValue: 0.95, myBestMetricValue: 0.8 })).toBe(50);
  });

  it("still pays a returning submitter who was never in the lead", () => {
    expect(bonusFor({ metricValue: 0.99, bestOtherMetricValue: 0.9, myBestMetricValue: 0.2 })).toBe(50);
  });
});

describe("computeMlAward — reuse deductions", () => {
  const withDataset = (over: Partial<MlAwardInput> = {}) =>
    computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 0.99,
        lineage: { datasetAuthorId: "alice", datasetContributionId: "contrib-alice" },
        ...over,
      })
    );

  it("redistributes rather than minting — the entries still sum to the gross award", () => {
    const entries = withDataset();
    const modelEntries = entries.filter((e) => e.rule_key !== "beat_best");
    expect(modelEntries.reduce((s, e) => s + e.points, 0)).toBe(250);
  });

  it("deducts the share from the reuser and credits the author", () => {
    const entries = withDataset();
    const deduction = entries.find(
      (e) => e.rule_key === "reuse_dataset" && e.points < 0
    );
    const credit = entries.find(
      (e) => e.rule_key === "reuse_dataset" && e.points > 0
    );

    expect(deduction).toMatchObject({ user_id: "bob", points: -50, source_user_id: "alice" });
    expect(credit).toMatchObject({ user_id: "alice", points: 50, source_user_id: "bob" });
  });

  it("attaches the author's credit to the author's own contribution", () => {
    // This is what keeps every ledger row's user_id equal to the owner of the
    // contribution it references — which is why the leaderboard needs no change.
    const credit = withDataset().find(
      (e) => e.rule_key === "reuse_dataset" && e.points > 0
    );
    expect(credit?.contribution_id).toBe("contrib-alice");
    expect(credit?.user_id).toBe("alice");
  });

  it("deducts from the beat-best bonus too — it is earned on the model", () => {
    const entries = withDataset();
    const bonusSplits = entries.filter(
      (e) => e.rule_key === "reuse_dataset" && e.meta?.sourceRule === "beat_best"
    );
    expect(bonusSplits.map((e) => e.points).sort((a, b) => a - b)).toEqual([-10, 10]);
  });

  it("does not deduct on the dataset step — only model points are shared", () => {
    const entries = computeMlAward(
      base({
        rule: "dataset",
        agentScore: 1,
        lineage: { datasetAuthorId: "alice", datasetContributionId: "contrib-alice" },
      })
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].rule_key).toBe("dataset");
  });

  it("never pays a contributor for reusing their own artifact", () => {
    const entries = withDataset({
      lineage: { datasetAuthorId: "bob", datasetContributionId: "contrib-bob-ds" },
    });
    expect(entries.some((e) => e.rule_key === "reuse_dataset")).toBe(false);
  });

  it("stacks dataset and model reuse additively", () => {
    const entries = withDataset({
      lineage: {
        datasetAuthorId: "alice",
        datasetContributionId: "contrib-alice",
        modelAuthorId: "carol",
        modelContributionId: "contrib-carol",
      },
    });
    // Isolate the metric award and its own splits — the beat-best bonus is
    // deducted separately and would otherwise blur the arithmetic.
    const bobNet = entries
      .filter(
        (e) =>
          e.user_id === "bob" &&
          (e.rule_key === "model_metric" || e.meta?.sourceRule === "model_metric")
      )
      .reduce((s, e) => s + e.points, 0);
    // 250 gross − 20% to Alice − 20% to Carol
    expect(bobNet).toBe(150);

    const fromMetric = (user: string) =>
      entries.find(
        (e) => e.user_id === user && e.points > 0 && e.meta?.sourceRule === "model_metric"
      )?.points;
    expect(fromMetric("alice")).toBe(50);
    expect(fromMetric("carol")).toBe(50);
  });

  it("deducts every model award, so the reuser's total is net of both splits", () => {
    const entries = withDataset({
      lineage: {
        datasetAuthorId: "alice",
        datasetContributionId: "contrib-alice",
        modelAuthorId: "carol",
        modelContributionId: "contrib-carol",
      },
    });
    const bobTotal = entries
      .filter((e) => e.user_id === "bob")
      .reduce((s, e) => s + e.points, 0);
    // (250 + 50) gross − 40% of each
    expect(bobTotal).toBe(180);
  });

  it("holds the floor when stacked shares would strip the reuser", () => {
    const greedy: MlRewardRules = {
      ...RULES,
      reuse: { datasetShare: 0.6, modelShare: 0.6, minKeepShare: 0.5 },
    };
    const entries = withDataset({
      rules: greedy,
      lineage: {
        datasetAuthorId: "alice",
        datasetContributionId: "contrib-alice",
        modelAuthorId: "carol",
        modelContributionId: "contrib-carol",
      },
    });
    const modelAward = entries.find((e) => e.rule_key === "model_metric")!;
    const bobDeductions = entries
      .filter((e) => e.user_id === "bob" && e.points < 0 && e.meta?.sourceRule === "model_metric")
      .reduce((s, e) => s + e.points, 0);

    // 120% would have been taken; the floor caps it at 50% of the gross award
    expect(modelAward.points + bobDeductions).toBeGreaterThanOrEqual(
      Math.round(modelAward.points * 0.5)
    );
  });
});

describe("computeMlAward — multi-dataset reuse (datasetUsages)", () => {
  it("splits the model award across every used dataset, weighted 1/N, keeping the reuser's own share whole", () => {
    // 1 own dataset + 2 community ones, each weighing a third — mirrors the
    // "3 datasets, 1 of mine + 2 from the community" scenario directly.
    const entries = computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 0.99,
        lineage: {
          datasetUsages: [
            { authorId: "alice", contributionId: "contrib-alice", weight: 1 / 3 },
            { authorId: "dave", contributionId: "contrib-dave", weight: 1 / 3 },
          ],
        },
      })
    );
    // Gross model_metric award is 250 (500 * 0.5 * 1). Each external third
    // deducts 20% of its own slice: round(250 * (1/3) * 0.2) = 17.
    const metricEntries = entries.filter(
      (e) => e.rule_key === "model_metric" || e.meta?.sourceRule === "model_metric"
    );
    expect(metricEntries.reduce((s, e) => s + e.points, 0)).toBe(250); // still redistributes, not minted

    expect(metricEntries.find((e) => e.user_id === "bob" && e.rule_key === "model_metric")?.points).toBe(250);
    const bobDeductions = metricEntries
      .filter((e) => e.user_id === "bob" && e.rule_key === "reuse_dataset")
      .reduce((s, e) => s + e.points, 0);
    expect(bobDeductions).toBe(-34); // -17 to alice, -17 to dave
    expect(metricEntries.find((e) => e.user_id === "alice")?.points).toBe(17);
    expect(metricEntries.find((e) => e.user_id === "dave")?.points).toBe(17);
  });

  it("deducts nothing for a dataset slice that is the reuser's own — datasetUsages never lists self", () => {
    // Only one external usage among the N implied by its weight (1/3): the
    // other two thirds are bob's own and simply don't appear in the array.
    // bestOtherMetricValue ties the metric so no beat-best bonus muddies the sum.
    const entries = computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 1,
        lineage: {
          datasetUsages: [{ authorId: "alice", contributionId: "contrib-alice", weight: 1 / 3 }],
        },
      })
    );
    const bobNet = entries
      .filter((e) => e.user_id === "bob" && (e.rule_key === "model_metric" || e.rule_key === "reuse_dataset"))
      .reduce((s, e) => s + e.points, 0);
    expect(bobNet).toBe(233); // 250 - round(250/3 * 0.2) = 250 - 17
  });

  it("falls back to the single datasetAuthorId candidate when datasetUsages is absent — unchanged legacy behavior", () => {
    // Same assertion as the existing singular reuse test, proving the new
    // branch does not disturb callers that haven't adopted multi-select yet.
    const entries = withDatasetLegacy();
    const deduction = entries.find((e) => e.rule_key === "reuse_dataset" && e.points < 0);
    expect(deduction).toMatchObject({ user_id: "bob", points: -50, source_user_id: "alice" });
  });

  function withDatasetLegacy() {
    return computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 0.99,
        lineage: { datasetAuthorId: "alice", datasetContributionId: "contrib-alice" },
      })
    );
  }
});

describe("computeMlAward — pool clamping", () => {
  it("awards nothing once the pool is empty", () => {
    expect(computeMlAward(base({ rule: "dataset", agentScore: 1, remainingPool: 0 }))).toEqual([]);
  });

  it("clamps the award to what is left and records the raw amount", () => {
    const [entry] = computeMlAward(
      base({ rule: "dataset", agentScore: 1, remainingPool: 100 })
    );
    expect(entry.points).toBe(100); // capped from 300
    expect(entry.meta).toMatchObject({ rawPoints: 300, clampedTo: 100 });
  });

  it("drains the pool across the metric award before the bonus", () => {
    const entries = computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 0.5,
        remainingPool: 260,
      })
    );
    expect(entries.find((e) => e.rule_key === "model_metric")?.points).toBe(250);
    // only 10 CP left for the 50-point bonus
    expect(entries.find((e) => e.rule_key === "beat_best")?.points).toBe(10);
  });

  it("splits the clamped amount, not the gross one", () => {
    const entries = computeMlAward(
      base({
        rule: "model_metric",
        metricValue: 1,
        bestOtherMetricValue: 0.99,
        remainingPool: 100,
        lineage: { datasetAuthorId: "alice", datasetContributionId: "contrib-alice" },
      })
    );
    // 250 gross clamped to 100, so Alice gets 20% of 100 rather than of 250
    expect(entries.find((e) => e.user_id === "alice" && e.points > 0)?.points).toBe(20);
  });
});

describe("simulateMaxDistribution", () => {
  it("sums every cap plus one bonus per contributor", () => {
    // (300 + 500 + 200) * 3 + 50 * 3
    expect(simulateMaxDistribution(RULES, 3)).toBe(3150);
  });

  it("ignores reuse, which redistributes without creating points", () => {
    const noReuse: MlRewardRules = {
      ...RULES,
      reuse: { datasetShare: 0, modelShare: 0, minKeepShare: 0.5 },
    };
    expect(simulateMaxDistribution(noReuse, 3)).toBe(simulateMaxDistribution(RULES, 3));
  });

  it("returns nothing for an empty challenge", () => {
    expect(simulateMaxDistribution(RULES, 0)).toBe(0);
  });
});
