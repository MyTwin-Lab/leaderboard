import { db, discord_messages } from "../db/drizzle";
import { eq } from "drizzle-orm";

export class DiscordMessageRepository {
  async create(data: {
    discord_message_id: string;
    conversation_id?: string | null;
    author_discord_id?: string | null;
    content: string;
    sent_at: Date;
  }) {
    const [row] = await db.insert(discord_messages).values(data).returning();
    return row;
  }

  async findByDiscordId(discord_message_id: string) {
    const [row] = await db.select().from(discord_messages).where(eq(discord_messages.discord_message_id, discord_message_id));
    return row ?? null;
  }
}
