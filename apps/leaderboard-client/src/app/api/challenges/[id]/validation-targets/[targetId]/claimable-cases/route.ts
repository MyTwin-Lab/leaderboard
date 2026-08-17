import { NextRequest, NextResponse } from 'next/server';
import {
  ReferenceCaseService,
  ValidationTargetError,
} from '../../../../../../../../../../packages/services/challenge/reference-case.service';
import {
  ValidationTargetRepository,
  CaseClaimRepository,
} from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const service = new ReferenceCaseService();
const targetRepo = new ValidationTargetRepository();
const caseClaimRepo = new CaseClaimRepository();

// GET /api/challenges/[id]/validation-targets/[targetId]/claimable-cases
// medical_pro only. Returns the reference cases still claimable by the
// requester on this specific target (metadata only — no bytes), plus their
// own unfinished claims on it so the client can resume an interrupted
// observe/reveal/vote sequence instead of re-offering the pick list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  try {
    const { id: challengeId, targetId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'medical_pro') {
      return NextResponse.json({ error: 'Only medical_pro users can claim a reference case' }, { status: 403 });
    }

    const target = await targetRepo.findById(targetId);
    if (!target || target.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const [claimable, myClaims] = await Promise.all([
      service.listClaimableCases({
        validationChallengeId: challengeId,
        contributionId: target.contribution_id,
        requestingUserId: user.id,
      }),
      caseClaimRepo.findByValidatorAndTarget(user.id, target.contribution_id),
    ]);

    return NextResponse.json({
      claimableCases: claimable.map(c => ({
        id: c.uuid,
        inputFilename: c.input_filename,
        inputContentType: c.input_content_type,
      })),
      myOpenClaims: myClaims
        .filter(c => !c.observed_at || !c.revealed_at)
        .map(c => ({ id: c.uuid, observed: !!c.observed_at, revealed: !!c.revealed_at })),
    });
  } catch (error) {
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching claimable reference cases:', error);
    return NextResponse.json({ error: 'Failed to fetch claimable reference cases' }, { status: 500 });
  }
}
