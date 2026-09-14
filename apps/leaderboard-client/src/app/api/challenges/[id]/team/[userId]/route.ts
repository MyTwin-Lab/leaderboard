import { NextRequest, NextResponse } from 'next/server';
import { ChallengeTeamRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const challengeTeamRepo = new ChallengeTeamRepository();

// DELETE /api/challenges/[id]/team/[userId] - Retirer un membre de l'équipe
//
// Réservé aux admins et au manager du challenge, rôle relu en base : le proxy
// ne garde que l'authentification, pas l'autorisation sur ce challenge.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id, userId } = await params;
    if (user.role !== 'admin' && !(await isManagerOfChallenge(user.id, id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await challengeTeamRepo.delete(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
