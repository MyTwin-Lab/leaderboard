import { describe, it, expect } from "vitest";
import { toDbChallenge, toDomainChallenge } from "./mappers.js";
import type { challenges } from "./drizzle.js";
import type { InferSelectModel } from "drizzle-orm";

type DbChallenge = InferSelectModel<typeof challenges>;

function baseRow(overrides: Partial<DbChallenge> = {}): DbChallenge {
  return {
    uuid: "11111111-1111-1111-1111-111111111111",
    index: 1,
    title: "Test challenge",
    slug: "test-challenge",
    status: "active",
    type: "code",
    start_date: null,
    end_date: null,
    description: null,
    roadmap: null,
    contribution_points_reward: 100,
    completion: 0,
    project_id: null,
    reward_rules: null,
    source_challenge_id: null,
    flow_config: { workspace_mode: "provided_repo" },
    flow_config_version: 1,
    cp_per_validation: null,
    required_validations: null,
    compute_enabled: false,
    workspace_mode: "provided_repo",
    created_at: new Date("2026-01-01T00:00:00Z"),
    closed_at: null,
    ...overrides,
  } as unknown as DbChallenge;
}

describe("toDomainChallenge — reward_rules", () => {
  it("passes the stored rules through: their shape belongs to the flow, which parses them", () => {
    const codeRules = { version: 1, delivery: { fixed: 25, cap: 75 } };
    expect(toDomainChallenge(baseRow({ reward_rules: codeRules })).reward_rules).toEqual(codeRules);
    expect(toDomainChallenge(baseRow({ reward_rules: { garbage: true } })).reward_rules).toEqual({ garbage: true });
  });

  it("returns null for null reward_rules", () => {
    expect(toDomainChallenge(baseRow({ reward_rules: null })).reward_rules).toBeNull();
  });
});

describe("toDomainChallenge — flow_config", () => {
  it("returns the stored configuration and its version", () => {
    const challenge = toDomainChallenge(baseRow({ flow_config: { workspace_mode: "own_repo" }, flow_config_version: 2 }));

    expect(challenge.flow_config).toEqual({ workspace_mode: "own_repo" });
    expect(challenge.flow_config_version).toBe(2);
  });

  it("rebuilds the configuration of a row written by the previous code, from the legacy columns", () => {
    expect(
      toDomainChallenge(baseRow({ flow_config: null, workspace_mode: "own_repo" })).flow_config,
    ).toEqual({ workspace_mode: "own_repo" });
    expect(
      toDomainChallenge(baseRow({ type: "ml", flow_config: null, compute_enabled: true })).flow_config,
    ).toEqual({ extensions: { compute: { enabled: true } } });
    expect(
      toDomainChallenge(
        baseRow({ type: "validation", flow_config: null, cp_per_validation: 40, required_validations: 3 }),
      ).flow_config,
    ).toEqual({ cp_per_validation: 40, required_validations: 3 });
  });
});

describe("toDbChallenge — legacy columns", () => {
  it("writes the legacy columns as a mirror of the configuration, until they are dropped", () => {
    const row = toDbChallenge({
      title: "ML",
      slug: "ml",
      status: "active",
      type: "ml",
      contribution_points_reward: 10,
      completion: 0,
      project_id: "",
      flow_config: { extensions: { compute: { enabled: true } } },
      flow_config_version: 1,
    });

    expect(row).toMatchObject({
      flow_config: { extensions: { compute: { enabled: true } } },
      flow_config_version: 1,
      compute_enabled: true,
      workspace_mode: null,
      cp_per_validation: null,
      required_validations: null,
    });
  });
});
