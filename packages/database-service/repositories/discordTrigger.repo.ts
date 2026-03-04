import { db, discord_triggers } from "../db/drizzle";

export class DiscordTriggerRepository {
  async create(data: {
    message_id: string;
    trigger_type: string;
    keyword_detected: string;
    language: string;
  }) {
    const [row] = await db.insert(discord_triggers).values(data).returning();
    return row;
  }
}
