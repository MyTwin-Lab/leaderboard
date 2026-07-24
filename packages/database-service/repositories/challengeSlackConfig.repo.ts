import { eq } from "drizzle-orm";
import { db, challenge_slack_configs } from "../db/drizzle.js";
import { toDomainChallengeSlackConfig } from "../db/mappers.js";
import type { ChallengeSlackConfig } from "../domain/entities.js";

export class ChallengeSlackConfigRepository {
  async findByChallenge(challengeId: string): Promise<ChallengeSlackConfig | null> {
    const rows = await db
      .select()
      .from(challenge_slack_configs)
      .where(eq(challenge_slack_configs.challenge_id, challengeId));
    return rows[0] ? toDomainChallengeSlackConfig(rows[0]) : null;
  }

  async findAllConfigured(): Promise<ChallengeSlackConfig[]> {
    const rows = await db.select().from(challenge_slack_configs);
    return rows.map(toDomainChallengeSlackConfig);
  }

  async upsert(data: {
    challenge_id: string;
    channel_id: string;
    channel_name?: string | null;
  }): Promise<ChallengeSlackConfig> {
    const set = {
      channel_id: data.channel_id,
      channel_name: data.channel_name ?? null,
      updated_at: new Date(),
    };
    const [row] = await db
      .insert(challenge_slack_configs)
      .values({ challenge_id: data.challenge_id, ...set })
      .onConflictDoUpdate({ target: challenge_slack_configs.challenge_id, set })
      .returning();
    return toDomainChallengeSlackConfig(row);
  }

  /**
   * Avance l'état opérationnel du cron. `last_ts` n'est fourni qu'en cas de
   * succès complet du run : un échec ne doit jamais faire avancer le curseur,
   * sinon les messages de la fenêtre échouée seraient perdus.
   */
  async updateCursor(
    challengeId: string,
    patch: { last_ts?: string; last_run_at?: Date; last_error?: string | null }
  ): Promise<void> {
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (patch.last_ts !== undefined) set.last_ts = patch.last_ts;
    if (patch.last_run_at !== undefined) set.last_run_at = patch.last_run_at;
    if (patch.last_error !== undefined) set.last_error = patch.last_error;

    await db
      .update(challenge_slack_configs)
      .set(set)
      .where(eq(challenge_slack_configs.challenge_id, challengeId));
  }

  async delete(challengeId: string): Promise<void> {
    await db
      .delete(challenge_slack_configs)
      .where(eq(challenge_slack_configs.challenge_id, challengeId));
  }
}
