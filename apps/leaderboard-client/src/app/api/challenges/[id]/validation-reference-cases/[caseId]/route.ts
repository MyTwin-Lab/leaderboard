import { NextRequest, NextResponse } from 'next/server';
import {
  ReferenceCaseRepository,
  CaseClaimRepository,
} from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const caseRepo = new ReferenceCaseRepository();
const caseClaimRepo = new CaseClaimRepository();

// DELETE /api/challenges/[id]/validation-reference-cases/[caseId]
// The case's own author, or an admin (not a plain manager — case authorship
// is a medical_pro-only trust boundary, moderation is admin-only). 409 once
// any claim already exists against the case — same guard shape as
// validation-targets/[targetId]'s vote-count check.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const { id: challengeId, caseId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await caseRepo.findInputById(caseId);
    if (!existing || existing.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Reference case not found' }, { status: 404 });
    }

    const isAuthor = existing.author_user_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const claims = await caseClaimRepo.findByReferenceCase(caseId);
    if (claims.length > 0) {
      return NextResponse.json(
        { error: `Cannot remove a reference case that already has ${claims.length} claim(s)` },
        { status: 409 }
      );
    }

    await caseRepo.delete(caseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing reference case:', error);
    return NextResponse.json({ error: 'Failed to remove reference case' }, { status: 500 });
  }
}
