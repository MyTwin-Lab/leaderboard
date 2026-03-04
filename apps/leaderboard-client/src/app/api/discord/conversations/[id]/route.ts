import { NextRequest, NextResponse } from "next/server";
import { DiscordConversationRepository } from "../../../../../../../../../packages/database-service/repositories";

const conversationRepo = new DiscordConversationRepository();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await conversationRepo.findWithMessages(id);
    if (!result) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { conversation, messages, helper, beneficiary } = result;

    // Format adapté à la consommation par le LLM
    return NextResponse.json({
      conversation_id: conversation.uuid,
      channel_id: conversation.channel_id,
      started_at: conversation.started_at,
      status: conversation.end_message_id ? "closed" : "open",
      helper: helper ? { discord_id: helper.discord_id, username: helper.username } : null,
      beneficiary: beneficiary ? { discord_id: beneficiary.discord_id, username: beneficiary.username } : null,
      messages: messages.map((m) => ({
        uuid: m.uuid,
        discord_message_id: m.discord_message_id,
        author_discord_id: m.author_discord_id,
        content: m.content,
        sent_at: m.sent_at,
      })),
    });
  } catch (error) {
    console.error("[GET /api/discord/conversations/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
