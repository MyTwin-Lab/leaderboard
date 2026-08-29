import { NextRequest, NextResponse } from 'next/server';

async function getChallengeService() {
  const { ChallengeService } = await import('../../../../../../../../packages/services/challenge/challenge.service');
  return new ChallengeService();
}

// POST /api/challenges/[id]/sync - Lancer une évaluation Sync Meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challengeService = await getChallengeService();
    const evaluations = await challengeService.runSyncEvaluation(id);
    return NextResponse.json({
      success: true,
      count: evaluations.length,
      evaluations
    });
  } catch (error) {
    console.error('Error syncing challenge:', error);
    return NextResponse.json(
      { error: 'Failed to sync challenge' },
      { status: 500 }
    );
  }
}
