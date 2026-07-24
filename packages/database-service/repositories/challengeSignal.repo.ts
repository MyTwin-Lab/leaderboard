import { eq } from "drizzle-orm";
import { db, challenge_signals } from "../db/drizzle.js";
import { toDomainChallengeSignal, toDbChallengeSignal } from "../db/mappers.js";
import type { ChallengeSignal } from "../domain/entities.js";
import { challengeSignalSchema } from "../domain/schemas_zod.js";

export class ChallengeSignalRepository {
  async findByChallenge(challengeId: string): Promise<ChallengeSignal[]> {
    const rows = await db
      .select()
      .from(challenge_signals)
      .where(eq(challenge_signals.challenge_id, challengeId))
      .orderBy(challenge_signals.position, challenge_signals.created_at);
    return rows.map(toDomainChallengeSignal);
  }

  async findById(uuid: string): Promise<ChallengeSignal | null> {
    const rows = await db
      .select()
      .from(challenge_signals)
      .where(eq(challenge_signals.uuid, uuid));
    return rows[0] ? toDomainChallengeSignal(rows[0]) : null;
  }

  async create(entity: Omit<ChallengeSignal, "uuid" | "created_at">): Promise<ChallengeSignal> {
    const validated = challengeSignalSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(challenge_signals)
      .values(toDbChallengeSignal(validated))
      .returning();
    return toDomainChallengeSignal(row);
  }

  async update(
    uuid: string,
    patch: Partial<Pick<ChallengeSignal, "label" | "description" | "reward_cp" | "icon" | "position">>
  ): Promise<ChallengeSignal | null> {
    const set: Record<string, unknown> = {};
    if (patch.label !== undefined) set.label = patch.label;
    if (patch.description !== undefined) set.description = patch.description || null;
    if (patch.reward_cp !== undefined) set.reward_cp = patch.reward_cp;
    if (patch.icon !== undefined) set.icon = patch.icon || null;
    if (patch.position !== undefined) set.position = patch.position;
    if (Object.keys(set).length === 0) return this.findById(uuid);

    const [row] = await db
      .update(challenge_signals)
      .set(set)
      .where(eq(challenge_signals.uuid, uuid))
      .returning();
    return row ? toDomainChallengeSignal(row) : null;
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(challenge_signals).where(eq(challenge_signals.uuid, uuid));
  }
}
