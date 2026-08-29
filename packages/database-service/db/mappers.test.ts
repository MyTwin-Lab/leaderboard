import { describe, it, expect } from "vitest";
import { toDomainChallenge } from "./mappers.js";
import type { challenges } from "./drizzle.js";
import type { InferSelectModel } from "drizzle-orm";

type DbChallenge = InferSelectModel<typeof challenges>;

function baseRow(reward_rules: unknown): DbChallenge {
  return {
    uuid: "11111111-1111-1111-1111-111111111111",
    index: 1,
    title: "Test challenge",
    status: "active",
    type: "code",
    start_date: null,
    end_date: null,
    description: null,
    roadmap: null,
    contribution_points_reward: 100,
    completion: 0,
    project_id: null,
    reward_rules,
    source_challenge_id: null,
    cp_per_validation: null,
    required_validations: null,
    compute_enabled: false,
    workspace_mode: "provided_repo",
  } as unknown as DbChallenge;
}

describe("toDomainChallenge — reward_rules", () => {
  it("maps an ML-shaped row to an MlRewardRules object", () => {
    const mlRules = {
      version: 1,
      dataset: { cap: 300 },
      model: { cap: 500, kaggleShare: 0.5, metric: { name: "auc", baseline: 0.5 }, beatBestBonus: 50 },
      apiPackaging: { cap: 200 },
      reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
    };
    const result = toDomainChallenge(baseRow(mlRules));
    expect(result.reward_rules).toEqual(mlRules);
  });

  it("maps a code-shaped row to a CodeRewardRules object (not erased to null)", () => {
    const codeRules = { version: 1, delivery: { fixed: 25, cap: 75 } };
    const result = toDomainChallenge(baseRow(codeRules));
    expect(result.reward_rules).toEqual(codeRules);
  });

  it("returns null for garbage reward_rules", () => {
    const result = toDomainChallenge(baseRow({ garbage: true }));
    expect(result.reward_rules).toBeNull();
  });

  it("returns null for null reward_rules", () => {
    const result = toDomainChallenge(baseRow(null));
    expect(result.reward_rules).toBeNull();
  });
});
