import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

// GET /api/challenges/[id]/validation-rewards — admin/manager only
// Pool state + per-validator breakdown for a validation challenge.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const entries = await rewardRepo.findByChallenge(challengeId);
    const distributed = entries.reduce((sum, e) => sum + e.points, 0);
    const pool = challenge.contribution_points_reward;

    const byUser = new Map<string, number>();
    for (const e of entries) {
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.points);
    }
    const users = await userRepo.findByIds([...byUser.keys()]);
    const usersById = new Map(users.map(u => [u.uuid, u]));

    return NextResponse.json({
      pool,
      distributed,
      remaining: Math.max(0, pool - distributed),
      requiredValidations: challenge.required_validations ?? 0,
      cpPerValidation: challenge.cp_per_validation ?? 0,
      breakdown: [...byUser.entries()]
        .map(([userId, points]) => ({ userId, userName: usersById.get(userId)?.full_name ?? 'Unknown', points }))
        .sort((a, b) => b.points - a.points),
    });
  } catch (error) {
    console.error('Error fetching validation rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch validation rewards' }, { status: 500 });
  }
}
