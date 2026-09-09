import { db, sandbox_rewards } from "../db/drizzle";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { toDomainSandboxReward } from "../db/mappers";
import type { SandboxReward } from "../domain/entities";

/**
 * SandboxRewardRepository
 * -----------------------
 * Ledger des CP du sandbox, séparé de `reward_entries` (§1.4 du plan).
 *
 * Append-only, comme le ledger ML — à une exception près : `delete`, qui est le
 * geste d'annulation d'un palier payé sur une vague frauduleuse. C'est *aussi*
 * la reprise des CP, puisqu'aucune colonne de cache n'existe : le total d'un
 * contributeur est toujours un SUM en direct, donc supprimer une ligne fait
 * baisser le classement immédiatement, sans resync à programmer.
 */
export class SandboxRewardRepository {
  /** Tout le ledger — c'est ce que l'agrégation du leaderboard consomme. */
  async findAll(): Promise<SandboxReward[]> {
    const rows = await db.select().from(sandbox_rewards);
    return rows.map(toDomainSandboxReward);
  }

  async findByUser(userId: string): Promise<SandboxReward[]> {
    const rows = await db
      .select()
      .from(sandbox_rewards)
      .where(eq(sandbox_rewards.user_id, userId))
      .orderBy(desc(sandbox_rewards.created_at));
    return rows.map(toDomainSandboxReward);
  }

  async findBySandbox(sandboxId: string): Promise<SandboxReward[]> {
    const rows = await db
      .select()
      .from(sandbox_rewards)
      .where(eq(sandbox_rewards.sandbox_id, sandboxId))
      .orderBy(desc(sandbox_rewards.created_at));
    return rows.map(toDomainSandboxReward);
  }

  /**
   * Les seuils déjà payés, par sandbox.
   *
   * L'état « palier payé » ne se déduit pas du compteur de stars : le
   * rattachement d'une identité anonyme à un compte peut faire *baisser* le
   * compteur sous un seuil déjà payé, et le palier reste acquis. Cette lecture
   * est donc la seule source de vérité de l'UI pour ce que le sandbox a déjà
   * touché — le compteur ne sert plus qu'à la progression vers le suivant.
   */
  async paidTierThresholdsBySandboxIds(sandboxIds: string[]): Promise<Map<string, number[]>> {
    if (sandboxIds.length === 0) return new Map();
    const rows = await db
      .select({ sandbox_id: sandbox_rewards.sandbox_id, tier_stars: sandbox_rewards.tier_stars })
      .from(sandbox_rewards)
      .where(
        and(
          inArray(sandbox_rewards.sandbox_id, sandboxIds),
          eq(sandbox_rewards.rule_key, "star_tier")
        )
      );

    const bySandbox = new Map<string, number[]>();
    for (const row of rows) {
      if (row.tier_stars === null) continue; // ne devrait pas exister sur 'star_tier'
      const thresholds = bySandbox.get(row.sandbox_id) ?? [];
      thresholds.push(row.tier_stars);
      bySandbox.set(row.sandbox_id, thresholds);
    }
    for (const thresholds of bySandbox.values()) thresholds.sort((a, b) => a - b);
    return bySandbox;
  }

  /**
   * Paie un palier, sauf s'il l'a déjà été. Renvoie `null` dans ce cas.
   *
   * C'est la brique d'idempotence de l'économie des stars. `ON CONFLICT DO
   * NOTHING` sur l'index unique partiel `(sandbox_id, tier_stars) WHERE
   * rule_key = 'star_tier'` : deux stars concurrentes qui franchissent le même
   * seuil produisent exactement une ligne, et `.returning()` vide est le signal
   * que l'autre l'a écrite. Le `where` passé ici est le prédicat de l'index,
   * sans lequel Postgres ne saurait pas quel index arbitre le conflit.
   */
  async insertTierIfAbsent(entry: {
    sandbox_id: string;
    user_id: string;
    tier_stars: number;
    points: number;
  }): Promise<SandboxReward | null> {
    const [inserted] = await db
      .insert(sandbox_rewards)
      .values({
        sandbox_id: entry.sandbox_id,
        user_id: entry.user_id,
        rule_key: "star_tier",
        tier_stars: entry.tier_stars,
        points: entry.points,
      })
      .onConflictDoNothing({
        target: [sandbox_rewards.sandbox_id, sandbox_rewards.tier_stars],
        where: sql`rule_key = 'star_tier'`,
      })
      .returning();
    return inserted ? toDomainSandboxReward(inserted) : null;
  }

  /**
   * Annulation administrative d'une ligne. Le total du leaderboard baisse
   * aussitôt, faute de cache. Un palier supprimé alors que le compteur reste
   * au-dessus du seuil sera re-payé à la prochaine star — c'est voulu : il est
   * alors légitime.
   */
  async delete(uuid: string): Promise<boolean> {
    const deleted = await db
      .delete(sandbox_rewards)
      .where(eq(sandbox_rewards.uuid, uuid))
      .returning({ uuid: sandbox_rewards.uuid });
    return deleted.length > 0;
  }
}
