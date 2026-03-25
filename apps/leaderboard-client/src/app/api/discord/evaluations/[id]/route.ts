import { NextRequest, NextResponse } from "next/server";
import { DiscordEvaluationRepository } from "../../../../../../../../../packages/database-service/repositories";

const evaluationRepo = new DiscordEvaluationRepository();

/**
 * GET /api/discord/evaluations/:id
 *
 * Endpoint admin — visualisation d'une évaluation Discord (phase 5.3).
 * Retourne les métadonnées de l'évaluation et ses participants.
 * Les messages ne sont pas retournés ici (stockés dans contributions.evaluation).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await evaluationRepo.findWithParticipants(id);
    if (!result) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const { evaluation, helper, beneficiary } = result;

    return NextResponse.json({
      evaluation_id: evaluation.uuid,
      channel_id: evaluation.channel_id,
      trigger_message_id: evaluation.trigger_message_id,
      emoji: evaluation.emoji,
      status: evaluation.status,
      score: evaluation.score,
      notes: evaluation.notes,
      created_at: evaluation.created_at,
      evaluated_at: evaluation.evaluated_at,
      helper: helper ? { discord_id: helper.discord_id, username: helper.username } : null,
      beneficiary: beneficiary ? { discord_id: beneficiary.discord_id, username: beneficiary.username } : null,
    });
  } catch (error) {
    console.error("[GET /api/discord/evaluations/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
