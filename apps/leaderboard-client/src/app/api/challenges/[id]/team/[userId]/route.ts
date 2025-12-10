import { NextRequest, NextResponse } from 'next/server';
import { ChallengeTeamRepository } from '../../../../../../../../../packages/database-service/repositories';

const challengeTeamRepo = new ChallengeTeamRepository();

// DELETE /api/challenges/[id]/team/[userId] - Retirer un membre de l'équipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
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
