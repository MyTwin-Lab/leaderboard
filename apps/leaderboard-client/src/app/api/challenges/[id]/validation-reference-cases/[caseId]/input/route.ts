import { NextRequest, NextResponse } from 'next/server';
import { ReferenceCaseRepository } from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const caseRepo = new ReferenceCaseRepository();

// GET /api/challenges/[id]/validation-reference-cases/[caseId]/input
// admin/manager, or the case's own author. Streams the known-input bytes.
// There is deliberately NO equivalent route for expected_output_bytes — the
// only path that can ever return those is POST
// .../validation-case-claims/[claimId]/reveal, and only after observed_at is
// set (see challenge-014 SPEC section 5 and ReferenceCaseRepository).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const { id: challengeId, caseId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const referenceCase = await caseRepo.findInputById(caseId);
    if (!referenceCase || referenceCase.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Reference case not found' }, { status: 404 });
    }

    const isAuthor = referenceCase.author_user_id === user.id;
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAuthor && !isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return new NextResponse(new Uint8Array(referenceCase.input_bytes), {
      status: 200,
      headers: buildSafeFileHeaders(referenceCase.input_content_type, referenceCase.input_filename),
    });
  } catch (error) {
    console.error('Error fetching reference case input:', error);
    return NextResponse.json({ error: 'Failed to fetch input' }, { status: 500 });
  }
}
