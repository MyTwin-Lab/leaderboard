import { NextRequest, NextResponse } from 'next/server';
import { ComputeRequestRepository } from '../../../../../../../../../packages/database-service/repositories/index.js';
import { ComputeRequestService } from '../../../../../../../../../packages/services/compute/compute-request.service.js';
import { getSessionUser } from '@/lib/auth';

const computeRequestRepo = new ComputeRequestRepository();
const computeRequestService = new ComputeRequestService();

// POST /api/challenges/[id]/compute-request/reveal-token — the owning
// contributor only. Consultable as many times as needed while the instance
// is 'ready' (not burn-after-read, see ComputeRequestService.revealToken).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: challengeId } = await params;
  const existing = await computeRequestRepo.findByChallengeAndUser(challengeId, user.id);
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Compute request not found' }, { status: 404 });
  }

  try {
    const { token, jupyterUrl } = await computeRequestService.revealToken(existing.uuid, user.id);
    return NextResponse.json({ token, jupyter_url: jupyterUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to reveal token' }, { status: 400 });
  }
}
