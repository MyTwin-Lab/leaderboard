import type { ActionContext } from "../../../../packages/registry/platform.js";
import { RewardEntryRepository, UserRepository } from "../../../../packages/database-service/repositories/index.js";
import { validationConfigOf } from "../config.js";

const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

/** `GET rewards` — l'état du pool et ce que chaque validateur a gagné. */
export async function validationRewards({ challenge }: ActionContext) {
  const entries = await rewardRepo.findByChallenge(challenge.uuid);
  const distributed = entries.reduce((sum, e) => sum + e.points, 0);
  const pool = challenge.contribution_points_reward;

  const byUser = new Map<string, number>();
  for (const e of entries) {
    byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.points);
  }
  const users = await userRepo.findByIds([...byUser.keys()]);
  const usersById = new Map(users.map((u) => [u.uuid, u]));
  const payout = validationConfigOf(challenge);

  return {
    pool,
    distributed,
    remaining: Math.max(0, pool - distributed),
    requiredValidations: payout.required_validations ?? 0,
    cpPerValidation: payout.cp_per_validation,
    breakdown: [...byUser.entries()]
      .map(([userId, points]) => ({ userId, userName: usersById.get(userId)?.full_name ?? "Unknown", points }))
      .sort((a, b) => b.points - a.points),
  };
}
