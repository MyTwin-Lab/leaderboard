import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ReferenceCaseService,
  ValidationTargetError,
  SelfVoteError,
  InsufficientRoleError,
  SelfAuthoredCaseError,
  DuplicateClaimError,
  EndpointCallError,
} from '../../../../../../../../../../packages/services/challenge/reference-case.service';
import {
  ValidationTargetRepository,
  ReferenceCaseRepository,
} from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isQualifiedReviewer } from '@/distribution/mytwin.validation.server';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const service = new ReferenceCaseService();
const targetRepo = new ValidationTargetRepository();
const caseRepo = new ReferenceCaseRepository();

const claimSchema = z.object({
  reference_case_id: z.string().uuid(),
});

// POST /api/challenges/[id]/validation-targets/[targetId]/claim
// qualified reviewer only. Claims a reference case on this target and tests it
// against the target's live endpoint in one atomic gesture — mirrors the old
// POST .../validate contract (raw response bytes + X-Validation-Status
// header), plus a new X-Claim-Id header so the client can chain the
// observation/reveal/verdict calls that follow.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, targetId } = await params;
    if (!(await isQualifiedReviewer(user.id, challengeId))) {
      return NextResponse.json({ error: 'Only qualified reviewers can claim a reference case' }, { status: 403 });
    }
    const body = await req.json();
    const { reference_case_id } = claimSchema.parse(body);

    const target = await targetRepo.findById(targetId);
    if (!target || target.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    // Un cas purgé n'a plus d'octets d'entrée : l'envoyer à l'endpoint
    // testerait un fichier vide. 410, comme les routes d'octets.
    if (await caseRepo.isPurged(reference_case_id)) {
      return NextResponse.json({ error: 'Reference case no longer available (purged after the retention period)' }, { status: 410 });
    }

    const { claim, liveResponse } = await service.claimCase({
      validationChallengeId: challengeId,
      contributionId: target.contribution_id,
      referenceCaseId: reference_case_id,
      validatorUserId: user.id,
    });

    // La réponse vient d'un endpoint tiers : son Content-Type n'est jamais
    // recopié tel quel. buildSafeFileHeaders normalise le type, pose nosniff
    // et force le téléchargement de tout ce qui n'est pas une image sûre.
    const headers = buildSafeFileHeaders(liveResponse.contentType, 'response') as Record<string, string>;
    headers['X-Validation-Status'] = String(liveResponse.status);
    headers['X-Claim-Id'] = claim.uuid;

    return new NextResponse(new Uint8Array(liveResponse.body), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (
      error instanceof InsufficientRoleError ||
      error instanceof SelfAuthoredCaseError ||
      error instanceof SelfVoteError
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof DuplicateClaimError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof EndpointCallError) {
      console.error('Validation endpoint call error:', error.message);
      return NextResponse.json({ error: `The API didn't respond correctly: ${error.message}` }, { status: 502 });
    }
    console.error('Error claiming reference case:', error);
    return NextResponse.json({ error: 'Failed to claim reference case' }, { status: 500 });
  }
}
