import { db, discord_conversations, discord_accounts } from "../db/drizzle";
import { eq } from "drizzle-orm";

export class DiscordConversationRepository {
  async findById(uuid: string) {
    const [row] = await db.select().from(discord_conversations).where(eq(discord_conversations.uuid, uuid));
    return row ?? null;
  }

  async create(data: {
    channel_id: string;
    trigger_message_id: string;
    helper_discord_id?: string | null;
    beneficiary_discord_id?: string | null;
  }) {
    const [row] = await db.insert(discord_conversations).values(data).returning();
    return row;
  }

  // Retourne la conversation avec les comptes Discord des participants
  async findWithParticipants(uuid: string) {
    const conversation = await this.findById(uuid);
    if (!conversation) return null;

    const helper = conversation.helper_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, conversation.helper_discord_id)).then(r => r[0] ?? null)
      : null;

    const beneficiary = conversation.beneficiary_discord_id
      ? await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, conversation.beneficiary_discord_id)).then(r => r[0] ?? null)
      : null;

    return { conversation, helper, beneficiary };
  }
}
