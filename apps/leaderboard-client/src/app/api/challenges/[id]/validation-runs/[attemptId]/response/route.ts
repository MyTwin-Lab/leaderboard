import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ValidationAttemptRepository,
  CaseClaimRepository,
} from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const challengeRepo = new ChallengeRepository();
const attemptRepo = new ValidationAttemptRepository();
const caseClaimRepo = new CaseClaimRepository();

// GET /api/challenges/[id]/validation-runs/[attemptId]/response — admin/manager only.
// Streams back exactly the raw response the validator saw from the target's endpoint.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const { id: challengeId, attemptId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const attempt = await attemptRepo.findById(attemptId);
    if (!attempt || attempt.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // See the sibling file/route.ts for why this falls back to the claim —
    // since challenge-014, response_bytes lives on the claim, not the attempt.
    if (attempt.reference_case_claim_id) {
      const claim = await caseClaimRepo.findById(attempt.reference_case_claim_id);
      if (!claim) return NextResponse.json({ error: 'Response not available (purged or missing)' }, { status: 410 });
      const headers = buildSafeFileHeaders(claim.response_content_type, 'response');
      (headers as Record<string, string>)['X-Validation-Status'] = String(claim.response_status);
      return new NextResponse(new Uint8Array(claim.response_bytes), { status: 200, headers });
    }

    if (!attempt.response_bytes) {
      return NextResponse.json({ error: 'Response not available (purged or missing)' }, { status: 410 });
    }

    const headers = buildSafeFileHeaders(attempt.response_content_type, 'response');
    if (attempt.response_status !== null) {
      (headers as Record<string, string>)['X-Validation-Status'] = String(attempt.response_status);
    }

    return new NextResponse(new Uint8Array(attempt.response_bytes), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error fetching validation run response:', error);
    return NextResponse.json({ error: 'Failed to fetch response' }, { status: 500 });
  }
}
