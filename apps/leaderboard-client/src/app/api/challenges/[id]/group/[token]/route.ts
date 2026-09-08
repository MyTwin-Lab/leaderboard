import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  UserRepository,
} from '../../../../../../../../../packages/database-service/repositories';
import { GROUP_MAX_SIZE, pickGroupOwner } from '../../../../../../../../../packages/services/challenge/group';
import { verifyRequestToken } from '@/lib/auth';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const userRepo = new UserRepository();

/**
 * GET /api/challenges/[id]/group/[token]
 *
 * Ce qu'il faut afficher à quelqu'un qui ouvre un lien d'invitation : le
 * prénom de celui qui l'a créé, et si le groupe est encore joignable.
 *
 * Endpoint dédié plutôt qu'un champ de l'overview : y publier les `group_id`
 * rendrait chaque groupe joignable sans lien, ce qui viderait l'invitation de
 * son sens. Ici il faut connaître le jeton exact pour obtenir une réponse, et
 * rien ne se liste.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id: challengeId, token } = await params;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const members = await challengeTeamRepo.findByGroup(challengeId, token);
    if (members.length === 0) {
      return NextResponse.json({ error: 'This invite is no longer valid' }, { status: 404 });
    }

    const owner = await userRepo.findById(pickGroupOwner(members));
    const alreadyIn = members.some(m => m.user_id === session.userId);
    const existingParticipation = await challengeTeamRepo.findByChallengeAndUser(challengeId, session.userId);

    // Les mêmes barrières que le POST /join, exposées à l'avance pour que
    // l'écran dise pourquoi plutôt que d'échouer au clic.
    const reason =
      challenge.status === 'completed' || challenge.status === 'archived' ? 'challenge_closed'
      : alreadyIn ? 'already_member'
      : existingParticipation ? 'already_solo'
      : members.length >= GROUP_MAX_SIZE ? 'group_full'
      : null;

    return NextResponse.json({
      ownerName: owner?.full_name ?? 'a contributor',
      size: members.length,
      maxSize: GROUP_MAX_SIZE,
      joinable: reason === null,
      reason,
    });
  } catch (error) {
    console.error('Error reading group invite:', error);
    return NextResponse.json({ error: 'Failed to read the invite' }, { status: 500 });
  }
}
