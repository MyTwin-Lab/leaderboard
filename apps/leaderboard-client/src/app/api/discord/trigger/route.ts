import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DiscordAccountRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordConversationRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordMessageRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordTriggerRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordService } from "../../../../../../../../packages/services/discord.service";

const accountRepo = new DiscordAccountRepository();
const conversationRepo = new DiscordConversationRepository();
const messageRepo = new DiscordMessageRepository();
const triggerRepo = new DiscordTriggerRepository();
const discordService = new DiscordService();

const triggerSchema = z.object({
  trigger_type: z.enum(["HELP_REQUEST", "GRATITUDE"]),
  keyword_detected: z.string().min(1),
  language: z.enum(["FR", "EN"]),
  channel_id: z.string().min(1),
  discord_message_id: z.string().min(1),
  content: z.string().min(1),
  sent_at: z.string().datetime(),
  author: z.object({
    discord_id: z.string().min(1),
    username: z.string().min(1),
  }),
  // Présent uniquement pour HELP_REQUEST (celui qui pose la question)
  beneficiary: z.object({
    discord_id: z.string().min(1),
    username: z.string().min(1),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = triggerSchema.parse(body);

    // 1. Upsert le compte Discord de l'auteur du message
    await accountRepo.upsert({ discord_id: data.author.discord_id, username: data.author.username });

    if (data.trigger_type === "HELP_REQUEST") {
      // 2a. Upsert le beneficiary (celui qui demande de l'aide)
      // L'auteur du message HELP_REQUEST est le beneficiary
      const conversation = await conversationRepo.create({
        channel_id: data.channel_id,
        beneficiary_discord_id: data.author.discord_id,
      });

      // 3. Insérer le message
      const message = await messageRepo.create({
        discord_message_id: data.discord_message_id,
        conversation_id: conversation.uuid,
        author_discord_id: data.author.discord_id,
        content: data.content,
        sent_at: new Date(data.sent_at),
      });

      // 4. Lier le message de départ à la conversation
      await conversationRepo.setStartMessage(conversation.uuid, message.uuid);

      // 5. Créer le trigger
      await triggerRepo.create({
        message_id: message.uuid,
        trigger_type: data.trigger_type,
        keyword_detected: data.keyword_detected,
        language: data.language,
      });

      return NextResponse.json({ conversation_id: conversation.uuid, message_id: message.uuid }, { status: 201 });
    }

    if (data.trigger_type === "GRATITUDE") {
      // 2b. Trouver la conversation ouverte dans ce channel
      const conversation = await conversationRepo.findOpenByChannel(data.channel_id);
      if (!conversation) {
        return NextResponse.json({ error: "No open conversation found in this channel" }, { status: 404 });
      }

      // 3. L'auteur du remerciement est le beneficiary → le helper est l'autre participant
      // Le helper est défini dans le body si le bot l'identifie
      if (data.beneficiary) {
        await accountRepo.upsert({ discord_id: data.beneficiary.discord_id, username: data.beneficiary.username });
      }

      // 4. Insérer le message de remerciement
      const message = await messageRepo.create({
        discord_message_id: data.discord_message_id,
        conversation_id: conversation.uuid,
        author_discord_id: data.author.discord_id,
        content: data.content,
        sent_at: new Date(data.sent_at),
      });

      // 5. Clore la conversation
      await conversationRepo.close(conversation.uuid, message.uuid);

      // 6. Créer le trigger
      await triggerRepo.create({
        message_id: message.uuid,
        trigger_type: data.trigger_type,
        keyword_detected: data.keyword_detected,
        language: data.language,
      });

      // 7. Initier l'évaluation LLM (statut pending — le LLM viendra lire GET /conversations/:id)
      await discordService.initEvaluation(conversation.uuid);

      return NextResponse.json({ conversation_id: conversation.uuid, message_id: message.uuid }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[POST /api/discord/trigger]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
