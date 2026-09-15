import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  NotificationRepository,
  UserRepository,
  buildGroupInviteDraft,
} from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const notificationRepo = new NotificationRepository();
const userRepo = new UserRepository();

const inviteBodySchema = z.object({ userId: z.string().uuid() });

/**
 * POST /api/challenges/[id]/group/invite — déposer une invitation de groupe
 * dans les notifications d'un contributeur.
 *
 * **La garde qui compte.** C'est désormais le serveur qui distribue un jeton de
 * groupe, là où auparavant un humain le copiait d'une modale. On vérifie donc
 * que la row `challenge_teams` de l'appelant porte bien un `group_id` : sans ce
 * test, n'importe quel compte connecté pourrait diffuser le jeton de n'importe
 * quel groupe, et l'invisibilité des groupes — « un groupe n'est joignable que
 * par son lien » — disparaîtrait.
 *
 * Le destinataire, lui, n'est pas contrôlé au-delà de son existence : inviter
 * quelqu'un qui a déjà rejoint est une notification gâchée, pas une faille, et
 * l'écran de barrière sur lequel il atterrit le lui dira (`already_member`).
 *
 * Rien n'est écrit ici pour la péremption : une invitation devenue caduque
 * tombe sur les quatre motifs que `GET /group/:token` produit déjà.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;

    const parsed = inviteBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A contributor id is required' }, { status: 400 });
    }
    const recipientId = parsed.data.userId;

    if (recipientId === user.id) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.status === 'completed' || challenge.status === 'archived') {
      return NextResponse.json({ error: 'This challenge is closed' }, { status: 403 });
    }

    // La garde : l'appelant doit être sur ce challenge *et* dans un groupe.
    const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, user.id);
    if (!participation?.group_id) {
      return NextResponse.json(
        { error: 'Only a member of a group on this challenge can invite' },
        { status: 403 }
      );
    }

    const [recipient, inviter] = await Promise.all([
      userRepo.findById(recipientId),
      userRepo.findById(user.id),
    ]);
    if (!recipient) return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });

    // `null` = la notification existait déjà. Du point de vue de l'expéditeur
    // la personne est invitée dans les deux cas, donc même réponse.
    await notificationRepo.insertIfAbsent(
      buildGroupInviteDraft({
        recipientId,
        challengeId,
        challengeTitle: challenge.title,
        challengeSlug: challenge.slug,
        groupToken: participation.group_id,
        fromUserId: user.id,
        fromName: inviter?.full_name ?? 'A contributor',
      })
    );

    return NextResponse.json({ sent: true }, { status: 201 });
  } catch (err) {
    console.error('Error sending group invite:', err);
    return NextResponse.json({ error: 'Failed to send the invitation' }, { status: 500 });
  }
}
