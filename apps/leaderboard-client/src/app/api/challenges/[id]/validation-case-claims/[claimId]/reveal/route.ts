import { NextRequest, NextResponse } from 'next/server';
import {
  ReferenceCaseService,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ObservationRequiredError,
} from '../../../../../../../../../../packages/services/challenge/reference-case.service';
import { getSessionUser } from '@/lib/auth';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const service = new ReferenceCaseService();

// POST /api/challenges/[id]/validation-case-claims/[claimId]/reveal
// medical_pro only, must own the claim. Returns the reference case's expected
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
    if (user.role !== 'medical_pro') {
      return NextResponse.json({ error: 'Only medical_pro users can reveal a reference case' }, { status: 403 });
    }

    const { claimId } = await params;
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
