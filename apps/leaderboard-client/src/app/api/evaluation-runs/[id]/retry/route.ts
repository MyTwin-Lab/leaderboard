import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';

const runsRepo = new EvaluationRunsRepository();

async function getChallengeService() {
  const { ChallengeService } = await import('../../../../../../../../packages/services/challenge/challenge.service');
  return new ChallengeService();
}

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

// POST /api/evaluation-runs/[id]/retry - Re-run the sync evaluation for the same challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
