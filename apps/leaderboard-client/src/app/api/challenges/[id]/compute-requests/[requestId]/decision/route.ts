import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../../../../packages/database-service/repositories/index.js';
import { ComputeRequestService } from '../../../../../../../../../../packages/services/compute/compute-request.service.js';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const challengeRepo = new ChallengeRepository();
const computeRequestService = new ComputeRequestService();

// POST /api/challenges/[id]/compute-requests/[requestId]/decision — admin/manager only.
// body: { decision: 'approve' | 'reject' | 'retry' }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const { id: challengeId, requestId } = await params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
  if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const challenge = await challengeRepo.findById(challengeId);
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  if (challenge.type !== 'ml') return NextResponse.json({ error: 'Not an ML challenge' }, { status: 400 });

  let decision: string;
  try {
    const body = await request.json();
    decision = body.decision;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (decision === 'approve' || decision === 'reject') {
      const updated = await computeRequestService.decide(requestId, user.id, decision);
      return NextResponse.json({ status: updated.status });
    }
    if (decision === 'retry') {
      await computeRequestService.retryProvisioning(requestId);
      return NextResponse.json({ status: 'provisioning' });
    }
    return NextResponse.json({ error: 'decision must be "approve", "reject" or "retry"' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to process decision' }, { status: 400 });
  }
}
