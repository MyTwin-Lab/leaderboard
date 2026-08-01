import { NextRequest, NextResponse } from 'next/server';
import { ComputeRequestRepository } from '../../../../../../../../packages/database-service/repositories/index.js';
import { ComputeRequestService } from '../../../../../../../../packages/services/compute/compute-request.service.js';
import type { ComputeRequest } from '../../../../../../../../packages/database-service/domain/entities.js';
import { getSessionUser } from '@/lib/auth';

const computeRequestRepo = new ComputeRequestRepository();
const computeRequestService = new ComputeRequestService();

function toClientShape(request: ComputeRequest | null) {
  if (!request) return null;
  // Deliberately excludes access_token_enc/iv — the token is only ever
  // returned by the dedicated reveal-token endpoint.
  return {
    id: request.uuid,
    status: request.status,
    requested_at: request.requested_at,
    approved_at: request.approved_at,
    expires_at: request.expires_at,
    ready_at: request.ready_at,
    expired_at: request.expired_at,
    error_message: request.error_message,
  };
}

// GET /api/challenges/[id]/compute-request — the current user's own request on this challenge, if any.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: challengeId } = await params;
  const request = await computeRequestRepo.findByChallengeAndUser(challengeId, user.id);
  return NextResponse.json({ request: toClientShape(request) });
}

// POST /api/challenges/[id]/compute-request — request GPU compute power on this ML challenge.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: challengeId } = await params;
  const result = await computeRequestService.requestCompute(challengeId, user.id);

  if ('error' in result) {
    const status = result.error === 'already_requested' ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ request: toClientShape(result.request) }, { status: 201 });
}
