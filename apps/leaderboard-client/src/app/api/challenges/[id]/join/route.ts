import { NextRequest, NextResponse } from 'next/server';
import { ChallengeTeamRepository } from '../../../../../../../../packages/database-service/repositories';
import type { ChallengeTeam } from '../../../../../../../../packages/database-service/domain/entities';
import { verifyRequestToken } from '@/lib/auth';

const challengeTeamRepo = new ChallengeTeamRepository();

// POST /api/challenges/[id]/join - Rejoindre un challenge (utilisateur connecté)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier que l'utilisateur est connecté
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login to join a challenge' },
        { status: 401 }
      );
    }

    const { id: challengeId } = await params;
    const userId = payload.userId;

    // Vérifier si l'utilisateur est déjà membre
    const existingMembers = await challengeTeamRepo.findByChallenge(challengeId);
    const alreadyMember = existingMembers.some((m: ChallengeTeam) => m.user_id === userId);
    
    if (alreadyMember) {
      return NextResponse.json(
        { error: 'You are already a member of this challenge' },
        { status: 409 }
      );
    }

    // Ajouter l'utilisateur au challenge
    await challengeTeamRepo.create({
      challenge_id: challengeId,
      user_id: userId,
    });

    return NextResponse.json({ success: true, message: 'Successfully joined the challenge' }, { status: 201 });
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json(
      { error: 'Failed to join challenge' },
      { status: 500 }
    );
  }
}
