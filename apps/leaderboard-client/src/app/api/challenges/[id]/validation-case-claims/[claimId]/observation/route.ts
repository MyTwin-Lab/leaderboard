import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ReferenceCaseService,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ObservationAlreadyRecordedError,
} from '../../../../../../../../../../packages/services/challenge/reference-case.service';
import { getSessionUser } from '@/lib/auth';

const service = new ReferenceCaseService();

const observationSchema = z.object({
  observation: z.string().trim().min(1),
});

// POST /api/challenges/[id]/validation-case-claims/[claimId]/observation
// medical_pro only, must own the claim. Records what they saw in the live
// response — BEFORE the expected output can be revealed (see .../reveal).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'medical_pro') {
      return NextResponse.json({ error: 'Only medical_pro users can record an observation' }, { status: 403 });
    }

    const { claimId } = await params;
    const body = await req.json();
    const { observation } = observationSchema.parse(body);

    await service.recordObservation({ claimId, validatorUserId: user.id, observation });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof ClaimNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenClaimAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ObservationAlreadyRecordedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error recording observation:', error);
    return NextResponse.json({ error: 'Failed to record observation' }, { status: 500 });
  }
}
