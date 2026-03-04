import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DiscordConversationRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordEvaluationRepository } from "../../../../../../../../packages/database-service/repositories";
import { DiscordService } from "../../../../../../../../packages/services/discord.service";

const conversationRepo = new DiscordConversationRepository();
const evaluationRepo = new DiscordEvaluationRepository();
const discordService = new DiscordService();

const evaluationResultSchema = z.object({
  conversation_id: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  // Détail de l'évaluation retourné par le LLM (structure libre)
  notes: z.object({
    justification: z.string(),
    criteria: z.array(
      z.object({
        name: z.string(),
        score: z.number(),
        comment: z.string().optional(),
      })
    ).optional(),
  }),
  // Le LLM peut choisir de skipper si la conversation est invalide
  skipped: z.boolean().default(false),
  skip_reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = evaluationResultSchema.parse(body);

    // Vérifier que la conversation existe et est bien clôturée
    const conversation = await conversationRepo.findById(data.conversation_id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (!conversation.end_message_id) {
      return NextResponse.json({ error: "Conversation is still open" }, { status: 400 });
    }

    // Récupérer ou créer l'évaluation associée
    let evaluation = await evaluationRepo.findByConversation(data.conversation_id);
    if (!evaluation) {
      evaluation = await evaluationRepo.create({ conversation_id: data.conversation_id });
    }

    if (data.skipped) {
      const updated = await evaluationRepo.markSkipped(evaluation.uuid, data.skip_reason ?? "No reason provided");
      return NextResponse.json(updated);
    }

    const updated = await evaluationRepo.saveResult(evaluation.uuid, {
      score: data.score,
      notes: data.notes,
    });

    // Attribution des points au helper
    await discordService.awardPoints(data.conversation_id, data.score);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[POST /api/discord/evaluation-result]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
