import { db, discord_evaluations } from "../db/drizzle";
import { eq } from "drizzle-orm";

export class DiscordEvaluationRepository {
  async create(data: { conversation_id: string }) {
    const [row] = await db.insert(discord_evaluations).values(data).returning();
    return row;
  }

  async findByConversation(conversation_id: string) {
    const [row] = await db
      .select()
      .from(discord_evaluations)
      .where(eq(discord_evaluations.conversation_id, conversation_id));
    return row ?? null;
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
