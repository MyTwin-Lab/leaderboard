import { db, discord_triggers } from "../db/drizzle";

export class DiscordTriggerRepository {
  async create(data: {
    conversation_id: string;
    trigger_message_id: string;
    emoji: string;
  }) {
    const [row] = await db.insert(discord_triggers).values(data).returning();
    return row;
  }
}
