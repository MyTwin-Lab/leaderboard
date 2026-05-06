import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../packages/database-service/repositories';

const runsRepo = new EvaluationRunsRepository();

async function getChallengeService() {
  const { ChallengeService } = await import('../../../../../../../../packages/services/challenge/challenge.service');
  return new ChallengeService();
}

// POST /api/evaluation-runs/[id]/retry - Re-run the sync evaluation for the same challenge
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await runsRepo.findWithChallenge(id);
    if (!result) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const challengeService = await getChallengeService();
    const evaluations = await challengeService.runSyncEvaluation(result.run.challenge_id);

    return NextResponse.json({
      success: true,
      count: evaluations.length,
      challengeId: result.run.challenge_id,
    });
  } catch (error) {
    console.error('Error retrying evaluation run:', error);
    return NextResponse.json({ error: 'Failed to retry evaluation run' }, { status: 500 });
  }
}
