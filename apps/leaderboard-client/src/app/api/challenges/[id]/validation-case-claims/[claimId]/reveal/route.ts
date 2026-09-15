import { NextRequest, NextResponse } from 'next/server';
import {
  ReferenceCaseService,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ObservationRequiredError,
} from '../../../../../../../../../../packages/services/challenge/reference-case.service';
import { CaseClaimRepository } from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isQualifiedReviewer } from '@/distribution/mytwin.validation.server';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const service = new ReferenceCaseService();
const caseClaimRepo = new CaseClaimRepository();

// POST /api/challenges/[id]/validation-case-claims/[claimId]/reveal
// qualified reviewer only, must own the claim. Returns the reference case's expected
// output — but ONLY once an observation has already been recorded on this
// claim (ObservationRequiredError otherwise). This is the server-side
// enforcement of the anti-confirmation-bias ordering from SPEC 4.3.7: a
// client can never obtain these bytes before submitting its own observation
// of the live response, no matter what it does out of order.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, claimId } = await params;
    if (!(await isQualifiedReviewer(user.id, challengeId))) {
      return NextResponse.json({ error: 'Only qualified reviewers can reveal a reference case' }, { status: 403 });
    }

    // Purge de conservation passée : 410 plutôt qu'un fichier vide. Seulement
    // pour le propriétaire du claim — pour tout autre appelant, le service
    // ci-dessous garde la main et répond 404/403 comme avant.
    const purgeState = await caseClaimRepo.findPurgeState(claimId);
    if (
      purgeState &&
      purgeState.validator_user_id === user.id &&
      (purgeState.claim_purged_at || purgeState.case_purged_at)
    ) {
      return NextResponse.json(
        { error: 'Expected output no longer available (purged after the retention period)' },
        { status: 410 }
      );
    }

    const expected = await service.revealExpectedOutput({ claimId, validatorUserId: user.id });

    return new NextResponse(new Uint8Array(expected.body), {
      status: 200,
      headers: buildSafeFileHeaders(expected.contentType, expected.filename),
    });
  } catch (error) {
    if (error instanceof ClaimNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenClaimAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ObservationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error revealing expected output:', error);
    return NextResponse.json({ error: 'Failed to reveal expected output' }, { status: 500 });
  }
}
