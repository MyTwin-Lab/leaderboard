import { db } from "../db/drizzle";
import { reward_entries } from "../db/drizzle";
import { eq, and, ne, sql, notInArray, gte, lt } from "drizzle-orm";
import { toDomainRewardEntry } from "../db/mappers";
import type { RewardEntry } from "../domain/entities";
import { rewardEntrySchema } from "../domain/schemas_zod";

export type RewardEntryDraft = Omit<RewardEntry, "uuid" | "created_at">;

/**
 * RewardEntryRepository
 * ---------------------
 * Ledger append-only des rewards ML. Aucune méthode d'update : une ligne
 * écrite ne bouge plus. Une correction se fait en ajoutant une ligne opposée.
 */
export class RewardEntryRepository {
  async findByChallenge(challengeId: string): Promise<RewardEntry[]> {
    const rows = await db
      .select()
      .from(reward_entries)
      .where(eq(reward_entries.challenge_id, challengeId));
    return rows.map(toDomainRewardEntry);
  }


  /**
   * Fenêtre [start, end) — bornes half-open, pour qu'une row tombant
   * exactement sur une borne appartienne à exactement un digest.
   */
  async findCreatedBetween(start: Date, end: Date): Promise<RewardEntry[]> {
    const rows = await db
      .select()
      .from(reward_entries)
      .where(and(gte(reward_entries.created_at, start), lt(reward_entries.created_at, end)));
    return rows.map(toDomainRewardEntry);
  }

  async findByContribution(contributionId: string): Promise<RewardEntry[]> {
    const rows = await db
      .select()
      .from(reward_entries)
      .where(eq(reward_entries.contribution_id, contributionId));
    return rows.map(toDomainRewardEntry);
  }

  async findByUserAndChallenge(userId: string, challengeId: string): Promise<RewardEntry[]> {
    const rows = await db
      .select()
      .from(reward_entries)
      .where(
        and(
          eq(reward_entries.user_id, userId),
          eq(reward_entries.challenge_id, challengeId)
        )
      );
    return rows.map(toDomainRewardEntry);
  }

  /**
   * Somme des points déjà distribués sur un challenge — sert au calcul du reliquat.
   * `excludeRuleKeys` permet d'ignorer les lignes hors pool (ex: 'slack_signal',
   * dont la récompense fixe ne consomme pas le pool du challenge).
   */
  async sumByChallenge(
    challengeId: string,
    opts?: { excludeRuleKeys?: string[] }
  ): Promise<number> {
    const filters = [eq(reward_entries.challenge_id, challengeId)];
    if (opts?.excludeRuleKeys?.length) {
      filters.push(notInArray(reward_entries.rule_key, opts.excludeRuleKeys));
    }
    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${reward_entries.points}), 0)::int` })
      .from(reward_entries)
      .where(and(...filters));
    return row?.total ?? 0;
  }

  /**
   * Meilleure métrique atteinte sur ce challenge, ou null si aucune.
   *
   * `excludeUserId` / `onlyUserId` séparent "le record des autres" de "mon
   * propre record" : le bonus se déclenche sur une prise de tête, pas sur une
   * amélioration de son propre score, sinon il se farme par paliers.
   */
  async bestMetricValue(
    challengeId: string,
    opts?: { excludeUserId?: string; onlyUserId?: string }
  ): Promise<number | null> {
    const filters = [
      eq(reward_entries.challenge_id, challengeId),
      eq(reward_entries.rule_key, "model_metric"),
    ];
    if (opts?.excludeUserId) filters.push(ne(reward_entries.user_id, opts.excludeUserId));
    if (opts?.onlyUserId) filters.push(eq(reward_entries.user_id, opts.onlyUserId));

    const [row] = await db
      .select({
        best: sql<number | null>`MAX((${reward_entries.meta}->>'metricValue')::float)`,
      })
      .from(reward_entries)
      .where(and(...filters));
    return row?.best ?? null;
  }

  async create(entry: RewardEntryDraft): Promise<RewardEntry> {
    const validated = rewardEntrySchema.omit({ uuid: true, created_at: true }).parse(entry);
    const [inserted] = await db
      .insert(reward_entries)
      .values({
        challenge_id: validated.challenge_id,
        user_id: validated.user_id,
        contribution_id: validated.contribution_id ?? null,
        rule_key: validated.rule_key,
        points: validated.points,
        source_user_id: validated.source_user_id ?? null,
        meta: validated.meta ?? null,
      })
      .returning();
    return toDomainRewardEntry(inserted);
  }

  /**
   * Écrit plusieurs lignes de ledger dans une seule transaction.
   *
   * `contributions.reward` (cache = agrégat des lignes du ledger visant cette
   * contribution) se resynchronise tout seul via le trigger Postgres
   * `trg_sync_contribution_reward` (drizzle/0018_reward_ledger_sync_trigger.sql) —
   * plus besoin de le faire à la main ici. Ça évite la dérive qu'on avait entre
   * ce chemin (synchronisé) et `create()` ci-dessus (qui, lui, ne l'était pas).
   */
  async createManyAndSyncRewards(entries: RewardEntryDraft[]): Promise<RewardEntry[]> {
    if (entries.length === 0) return [];

    const validated = entries.map((e) =>
      rewardEntrySchema.omit({ uuid: true, created_at: true }).parse(e)
    );

    const inserted = await db
      .insert(reward_entries)
      .values(
        validated.map((v) => ({
          challenge_id: v.challenge_id,
          user_id: v.user_id,
          contribution_id: v.contribution_id ?? null,
          rule_key: v.rule_key,
          points: v.points,
          source_user_id: v.source_user_id ?? null,
          meta: v.meta ?? null,
        }))
      )
      .returning();

    return inserted.map(toDomainRewardEntry);
  }
}
