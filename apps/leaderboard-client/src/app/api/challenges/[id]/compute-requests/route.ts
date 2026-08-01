import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ComputeRequestRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories/index.js';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const computeRequestRepo = new ComputeRequestRepository();
const userRepo = new UserRepository();

// GET /api/challenges/[id]/compute-requests — admin/manager only.
// Every compute request on this ML challenge — never includes the
// contributor's instance access token (see REQUEST_SUMMARY_COLUMNS).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'ml') return NextResponse.json({ error: 'Not an ML challenge' }, { status: 400 });

    const requests = await computeRequestRepo.findByChallenge(challengeId);
    const requesters = await userRepo.findByIds([...new Set(requests.map(r => r.user_id))]);
    const requestersById = new Map(requesters.map(u => [u.uuid, u]));

    return NextResponse.json({
      requests: requests.map(r => ({
        id: r.uuid,
        requesterName: requestersById.get(r.user_id)?.full_name ?? 'Unknown',
        status: r.status,
        requested_at: r.requested_at,
        decided_at: r.decided_at,
        approved_at: r.approved_at,
        expires_at: r.expires_at,
        error_message: r.error_message,
      })),
    });
  } catch (error) {
    console.error('Error fetching compute requests:', error);
    return NextResponse.json({ error: 'Failed to fetch compute requests' }, { status: 500 });
  }
}
