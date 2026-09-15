import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  RewardEntryRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { readChallengeRewards } from '../../../../../../../../packages/capabilities/rewards';
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const rewardRepo = new RewardEntryRepository();

// GET /api/challenges/[id]/rewards
// L'état du pool d'un challenge doté de règles de récompense (pool, distribué,
// reste, répartition) et ce que son flow y ajoute. Un visiteur anonyme ne
// reçoit que les champs que le flow déclare publics.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    // Même garde que /overview — le challenge est déjà chargé ci-dessus.
    const session = await verifyRequestToken(request);
    if (!session && !isPubliclyVisible(challenge)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const rewards = await readChallengeRewards(challenge, rewardRepo);
    if (!rewards) {
      return NextResponse.json({ error: 'No reward pool for this challenge type' }, { status: 400 });
    }

    return NextResponse.json(session ? rewards.full : rewards.public);
  } catch (error) {
    console.error('Error fetching challenge rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch challenge rewards' }, { status: 500 });
  }
}
