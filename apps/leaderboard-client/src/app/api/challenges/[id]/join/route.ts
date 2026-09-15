import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { GROUP_MAX_SIZE } from '../../../../../../../../packages/capabilities/groups';
import { copyBoardTemplate, usesBoard } from '../../../../../../../../packages/capabilities/board';
import {
  flowUses,
  runGroupJoinHooks,
  runJoinHooks,
} from '../../../../../../../../packages/capabilities/challenge-hooks';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

/**
 * Corps optionnel : sans lui, on rejoint en solo comme avant.
 * - `mode: 'group'` crée un groupe et renvoie son jeton d'invitation.
 * - `group: <uuid>` rejoint un groupe existant via le lien reçu.
 */
const joinBodySchema = z.object({
  mode: z.enum(['solo', 'group']).optional(),
  group: z.string().uuid().optional(),
});

// POST /api/challenges/[id]/join — rejoindre un challenge.
// La participation est commune à tous les flows. Le board est copié si le flow
// en a un ; le reste (une branche perso, par exemple) revient à ses hooks.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized - Please login to join a challenge' }, { status: 401 });
    }
    const { id: challengeId } = await params;
    const userId = payload.userId;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.status === 'completed' || challenge.status === 'archived') {
      return NextResponse.json({ error: 'This challenge is closed' }, { status: 403 });
    }

    const existing = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (existing) {
      // Bascule solo → groupe refusée : le contributeur a déjà un board copié
      // et une branche provisionnée, qu'il faudrait abandonner ou fusionner.
      return NextResponse.json({ error: 'You are already a member of this challenge' }, { status: 409 });
    }

    const parsedBody = joinBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid join options' }, { status: 400 });
    }
    const { mode: joinMode, group: invitedGroupId } = parsedBody.data;

    if ((joinMode === 'group' || invitedGroupId) && !flowUses(challenge.type, 'groups')) {
      return NextResponse.json({ error: 'This challenge does not accept groups' }, { status: 400 });
    }

    // Rejoindre un groupe existant : on ne copie pas de board — le workspace
    // est celui du porteur. Le lien EST l'invitation, donc les seules
    // barrières sont ici.
    if (invitedGroupId) {
      const groupMembers = await challengeTeamRepo.findByGroup(challengeId, invitedGroupId);
      if (groupMembers.length === 0) {
        return NextResponse.json({ error: 'This group no longer exists' }, { status: 404 });
      }
      if (groupMembers.length >= GROUP_MAX_SIZE) {
        return NextResponse.json(
          { error: `This group is full (${GROUP_MAX_SIZE} members maximum)` },
          { status: 409 }
        );
      }

      await challengeTeamRepo.create({
        challenge_id: challengeId,
        user_id: userId,
        group_id: invitedGroupId,
      });

      const report = await runGroupJoinHooks({ challenge, userId, groupId: invitedGroupId });
      const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
      return NextResponse.json(
        { participation, tasksCreated: 0, group_id: invitedGroupId, ...report },
        { status: 201 }
      );
    }

    // Créer un groupe, c'est un join normal qui porte en plus un group_id : le
    // créateur reçoit bien son board et son workspace, que les autres rejoindront.
    const groupId = joinMode === 'group' ? randomUUID() : null;

    await challengeTeamRepo.create({
      challenge_id: challengeId,
      user_id: userId,
      ...(groupId ? { group_id: groupId } : {}),
    });

    const tasksCreated = usesBoard(challenge.type) ? await copyBoardTemplate(challengeId, userId) : 0;
    const report = await runJoinHooks({ challenge, userId, groupId });

    const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    // `group_id` n'est renvoyé qu'à son créateur : c'est le jeton d'invitation
    // qu'il partagera lui-même, il ne se lit nulle part ailleurs.
    return NextResponse.json(
      { participation, tasksCreated, ...(groupId ? { group_id: groupId } : {}), ...report },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
  }
}
