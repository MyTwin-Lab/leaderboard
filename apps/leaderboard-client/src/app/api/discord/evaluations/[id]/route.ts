import { NextRequest, NextResponse } from "next/server";
import { DiscordEvaluationRepository } from "../../../../../../../../packages/database-service/repositories";

const evaluationRepo = new DiscordEvaluationRepository();

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
      metadata: evaluation.metadata,
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
