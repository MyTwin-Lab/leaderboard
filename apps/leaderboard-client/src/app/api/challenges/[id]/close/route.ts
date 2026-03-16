import { NextRequest, NextResponse } from 'next/server';
import { ChallengeService } from '../../../../../../../../packages/services/challenge.service';

const challengeService = new ChallengeService();

// POST /api/challenges/[id]/close - Clôturer un challenge et distribuer les rewards
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rewards = await challengeService.computeChallengeRewards(id);
    return NextResponse.json({ 
      success: true, 
      count: rewards.length,
      rewards 
    });
  } catch (error) {
    console.error('Error closing challenge:', error);
    return NextResponse.json(
      { error: 'Failed to close challenge' },
      { status: 500 }
    );
  }
}
