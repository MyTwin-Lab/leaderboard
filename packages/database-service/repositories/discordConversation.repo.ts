import { db, discord_conversations, discord_messages, discord_accounts } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";

export class DiscordConversationRepository {
  async findById(uuid: string) {
    const [row] = await db.select().from(discord_conversations).where(eq(discord_conversations.uuid, uuid));
    return row ?? null;
  }

  // Trouve une conversation ouverte (sans end_message_id) dans un channel
  async findOpenByChannel(channel_id: string) {
    const [row] = await db
      .select()
      .from(discord_conversations)
      .where(and(eq(discord_conversations.channel_id, channel_id), isNull(discord_conversations.end_message_id)));
    return row ?? null;
  }

  async create(data: {
    channel_id: string;
    helper_discord_id?: string | null;
    beneficiary_discord_id?: string | null;
    start_message_id?: string | null;
  }) {
    const [row] = await db.insert(discord_conversations).values(data).returning();
    return row;
  }

  async setStartMessage(uuid: string, message_uuid: string) {
    const [row] = await db
      .update(discord_conversations)
      .set({ start_message_id: message_uuid })
      .where(eq(discord_conversations.uuid, uuid))
      .returning();
    return row;
  }

  async close(uuid: string, end_message_id: string) {
    const [row] = await db
      .update(discord_conversations)
      .set({ end_message_id })
      .where(eq(discord_conversations.uuid, uuid))
      .returning();
    return row;
  }

  // Retourne la conversation avec ses messages et les comptes Discord associés
  async findWithMessages(uuid: string) {
    const conversation = await this.findById(uuid);
    if (!conversation) return null;

    const messages = await db
      .select()
      .from(discord_messages)
      .where(eq(discord_messages.conversation_id, uuid))
      .orderBy(discord_messages.sent_at);

    const helper = conversation.helper_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, conversation.helper_discord_id)).then(r => r[0] ?? null)
      : null;

    const beneficiary = conversation.beneficiary_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, conversation.beneficiary_discord_id)).then(r => r[0] ?? null)
      : null;

    return { conversation, messages, helper, beneficiary };
  }
}
