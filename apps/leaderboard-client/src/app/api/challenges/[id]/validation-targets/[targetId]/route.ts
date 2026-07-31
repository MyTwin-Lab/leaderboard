import { NextRequest, NextResponse } from 'next/server';
import { ValidationTargetRepository, ValidationAttemptRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const targetRepo = new ValidationTargetRepository();
const attemptRepo = new ValidationAttemptRepository();

// DELETE /api/challenges/[id]/validation-targets/[targetId] — admin/manager only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  try {
    const { id: challengeId, targetId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await targetRepo.findById(targetId);
    if (!existing || existing.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const attempts = await attemptRepo.findByChallengeAndContribution(challengeId, existing.contribution_id);
    if (attempts.length > 0) {
      return NextResponse.json(
        { error: `Cannot remove a target that already has ${attempts.length} vote(s)` },
        { status: 409 }
      );
    }

    await targetRepo.delete(targetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing validation target:', error);
    return NextResponse.json({ error: 'Failed to remove validation target' }, { status: 500 });
  }
}
