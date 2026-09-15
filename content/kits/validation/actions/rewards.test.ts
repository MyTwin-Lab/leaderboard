import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  rewardRepo: { findByChallenge: vi.fn() },
  userRepo: { findByIds: vi.fn() },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  RewardEntryRepository: class { constructor() { return h.rewardRepo; } },
  UserRepository: class { constructor() { return h.userRepo; } },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { validationRewards } from "./rewards.js";

const rewardsOf = (challenge: Record<string, unknown>) =>
  validationRewards(actionContext({ challenge: { uuid: "challenge-1", type: "endpoint-validation", ...challenge }, user: { role: "admin" } }));

beforeEach(() => {
  vi.clearAllMocks();
  h.rewardRepo.findByChallenge.mockResolvedValue([]);
  h.userRepo.findByIds.mockResolvedValue([]);
});

describe("GET rewards", () => {
  it("computes pool state and a per-validator breakdown sorted by points desc", async () => {
    h.rewardRepo.findByChallenge.mockResolvedValue([
      { user_id: "u1", points: 10 },
      { user_id: "u2", points: 30 },
      { user_id: "u1", points: 5 },
    ]);
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "u1", full_name: "Alice" }, { uuid: "u2", full_name: "Bob" }]);

    const result = await rewardsOf({ contribution_points_reward: 100, flow_config: { required_validations: 3, cp_per_validation: 5 } });

    expect(h.rewardRepo.findByChallenge).toHaveBeenCalledWith("challenge-1");
    expect(result).toEqual({
      pool: 100,
      distributed: 45,
      remaining: 55,
      requiredValidations: 3,
      cpPerValidation: 5,
      breakdown: [
        { userId: "u2", userName: "Bob", points: 30 },
        { userId: "u1", userName: "Alice", points: 15 },
      ],
    });
  });

  it("clamps remaining to 0 when distributed exceeds the pool, and reads an empty configuration as zeros", async () => {
    h.rewardRepo.findByChallenge.mockResolvedValue([{ user_id: "u1", points: 50 }]);
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "u1", full_name: "Alice" }]);

    const result = await rewardsOf({ contribution_points_reward: 10, flow_config: {} });

    expect(result).toMatchObject({ remaining: 0, requiredValidations: 0, cpPerValidation: 0 });
  });

  it('falls back to "Unknown" for a user that cannot be resolved', async () => {
    h.rewardRepo.findByChallenge.mockResolvedValue([{ user_id: "u1", points: 5 }]);

    const result = await rewardsOf({ contribution_points_reward: 10 });

    expect(result.breakdown).toEqual([{ userId: "u1", userName: "Unknown", points: 5 }]);
  });
});
