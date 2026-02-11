import { NextRequest, NextResponse } from 'next/server';
import { ChallengeService } from '../../../../../../../../packages/services/challenge.service';

const challengeService = new ChallengeService();

// POST /api/challenges/[id]/sync - Lancer une évaluation Sync Meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
