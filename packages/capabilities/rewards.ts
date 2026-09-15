import type { Challenge, RewardEntry } from "../database-service/domain/entities.js";
import { PlatformRegistry } from "../registry/platform.js";
import { outOfPoolRuleKeys, remainingPool } from "./pool.js";

/**
 * Capacité `rewards` — l'état du pool d'un challenge
 * -------------------------------------------------
 * Le core calcule ce qui vaut pour tout challenge doté de règles de
 * récompense : le pool, ce qui en est distribué, ce qui reste, et la
 * répartition par personne. Le flow y ajoute ses propres champs
 * (`FlowDefinition.rewards`), et dit lesquels un visiteur anonyme peut lire.
 */

export interface RewardsLedger {
  findByChallenge(challengeId: string): Promise<RewardEntry[]>;
  maxMetaNumber(challengeId: string, opts: { ruleKey: string; field: string }): Promise<number | null>;
}

export interface ChallengeRewards {
  pool: number;
  distributed: number;
  remaining: number;
  breakdown: Array<{ userId: string; points: number }>;
  [field: string]: unknown;
}

export interface ChallengeRewardsReading {
  /** Pour un compte connecté. */
  full: ChallengeRewards;
  /** Pour un visiteur anonyme : les seuls champs que le flow déclare publics. */
  public: Record<string, unknown>;
}

/** L'état du pool, ou `null` pour un challenge dont le flow n'a pas de règles de récompense. */
export async function readChallengeRewards(challenge: Challenge, ledger: RewardsLedger): Promise<ChallengeRewardsReading | null> {
  const flow = PlatformRegistry.flow(challenge.type);
  if (!flow?.rules) return null;

  const entries = await ledger.findByChallenge(challenge.uuid);

  // Les lignes de réutilisation s'annulent (−40 à qui réutilise, +40 à
  // l'auteur) : la somme des lignes qui consomment le pool est exactement ce
  // que le pool a payé. Une récompense hors pool reste dans la répartition.
  const outOfPool = new Set(outOfPoolRuleKeys());
  const distributed = entries.filter((e) => !outOfPool.has(e.rule_key)).reduce((sum, e) => sum + e.points, 0);
  const pool = challenge.contribution_points_reward;

  const byUser = new Map<string, number>();
  for (const e of entries) byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.points);

  const extra = flow.rewards
    ? await flow.rewards.summarize({
        challenge,
        entries,
        maxMetaNumber: (opts) => ledger.maxMetaNumber(challenge.uuid, opts),
      })
    : {};

  const full: ChallengeRewards = {
    ...extra,
    pool,
    distributed,
    remaining: remainingPool(pool, distributed),
    breakdown: [...byUser.entries()]
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points),
  };

  const publicFields = flow.rewards?.publicFields ?? [];
  const publicView = Object.fromEntries(publicFields.filter((field) => field in extra).map((field) => [field, extra[field]]));

  return { full, public: publicView };
}
