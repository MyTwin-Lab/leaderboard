import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const runsRepo = new EvaluationRunsRepository();

async function getChallengeService() {
  const { ChallengeService } = await import('../../../../../../../../packages/services/challenge/challenge.service');
  return new ChallengeService();
}

async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
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
