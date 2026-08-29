import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ValidationChallengeService,
  ValidationTargetError,
  SelfVoteError,
  DuplicateVerdictError,
  InsufficientRoleError,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ClaimNotRevealedError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

const castVerdictSchema = z.object({
  contribution_id: z.string().uuid(),
  verdict: z.enum(['works', 'broken']),
  // Required unconditionally as of challenge-014 — no more works/broken split.
  description: z.string().trim().min(1),
  reference_case_claim_id: z.string().uuid(),
});

// POST /api/challenges/[id]/validation-verdicts — medical_pro only, after
// claiming a reference case, recording an observation, and viewing its
// revealed expected output (see POST .../validation-targets/[targetId]/claim,
// .../validation-case-claims/[claimId]/observation, .../reveal).
// JSON body: contribution_id, verdict, description, reference_case_claim_id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'medical_pro') {
      return NextResponse.json({ error: 'Only medical_pro users can cast a verdict' }, { status: 403 });
    }

    const { id: challengeId } = await params;
    const body = await req.json();
    const parsed = castVerdictSchema.parse(body);

    const result = await service.castVerdict({
      validationChallengeId: challengeId,
      contributionId: parsed.contribution_id,
      validatorUserId: user.id,
      verdict: parsed.verdict,
      description: parsed.description,
      referenceCaseClaimId: parsed.reference_case_claim_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof InsufficientRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SelfVoteError || error instanceof ForbiddenClaimAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateVerdictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ClaimNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ClaimNotRevealedError || error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error casting validation verdict:', error);
    return NextResponse.json({ error: 'Failed to cast verdict' }, { status: 500 });
  }
}
