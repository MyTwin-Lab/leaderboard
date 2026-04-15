import { db, discord_evaluations, discord_accounts } from "../db/drizzle";
import { eq } from "drizzle-orm";

export class DiscordEvaluationRepository {
  async create(data: {
    channel_id: string;
    trigger_message_id: string;
    emoji: string;
    helper_discord_id?: string | null;
    beneficiary_discord_id?: string | null;
    score?: number | null;
    status?: string;
    notes?: unknown;
  }) {
    const [row] = await db.insert(discord_evaluations).values(data).returning();
    return row;
  }

  async findById(uuid: string) {
    const [row] = await db
      .select()
      .from(discord_evaluations)
      .where(eq(discord_evaluations.uuid, uuid));
    return row ?? null;
  }

  async findByTriggerMessage(trigger_message_id: string) {
    const [row] = await db
      .select()
      .from(discord_evaluations)
      .where(eq(discord_evaluations.trigger_message_id, trigger_message_id));
    return row ?? null;
  }

  // Retourne l'évaluation avec les comptes Discord des participants
  async findWithParticipants(uuid: string) {
    const evaluation = await this.findById(uuid);
    if (!evaluation) return null;

    const helper = evaluation.helper_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, evaluation.helper_discord_id)).then(r => r[0] ?? null)
      : null;

    const beneficiary = evaluation.beneficiary_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, evaluation.beneficiary_discord_id)).then(r => r[0] ?? null)
      : null;

    return { evaluation, helper, beneficiary };
  }

  async findByHelperDiscordId(discord_id: string) {
    return db
      .select()
      .from(discord_evaluations)
      .where(eq(discord_evaluations.helper_discord_id, discord_id));
  }

  async saveResult(uuid: string, data: { score: number; notes: unknown }) {
    const [row] = await db
      .update(discord_evaluations)
      .set({ score: data.score, notes: data.notes, status: "evaluated", evaluated_at: new Date() })
      .where(eq(discord_evaluations.uuid, uuid))
      .returning();
    return row;
  }

  async markSkipped(uuid: string, reason: string) {
    const [row] = await db
      .update(discord_evaluations)
      .set({ status: "skipped", notes: { reason }, evaluated_at: new Date() })
      .where(eq(discord_evaluations.uuid, uuid))
      .returning();
    return row;
  }
}
