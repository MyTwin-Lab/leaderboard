import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  TaskRepository,
  ChallengeRepoRepository,
  ContributionRepository,
  ContributionMemberRepository,
  SyncMeetingRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicOverview, toSignedInOverview } from '@/lib/public/overview';
import { groupContextFrom, pickGroupOwner } from '../../../../../../../../packages/capabilities/groups';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const contributionRepo = new ContributionRepository();
const contributionMemberRepo = new ContributionMemberRepository();
// Le repository et non SyncMeetingService : le service instancie les clients
// Google Calendar/Meet dans son constructeur, qui lèvent sans compte de service
// configuré — et toute la page challenge tombait en 500 avec eux.
const syncMeetingRepo = new SyncMeetingRepository();

// GET /api/challenges/[id]/overview
//
// Aggregates the challenge-scoped reads that both /challenges/[id] (public)
// and /challenges/[id]/manage (ChallengeManageView) need — challenge, team,
// tasks+assignees, meetings, repos, contributions, participants — into a
// single response. Shared by both pages/components with the same
// react-query key, so navigating between them reuses the cache instead of
// re-fetching.
//
// La réponse dépend du visiteur, jamais de la page : `toPublicOverview` sans
// session, `toSignedInOverview` sinon (voir lib/public/overview.ts pour ce que
// voit un membre, un non-membre, un manager ou un admin). La vue manager n'est
// ouverte qu'aux admins et managers, qui reçoivent tasks, participants et
// meetings entiers.
//
// repo-activity is intentionally NOT included: it calls external connectors
// (GitHub/Kaggle) and can be slow or flaky, so it stays its own request and
// never blocks the rest of this page from rendering.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const challenge = await challengeRepo.findById(id);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // 404 et non 401 : un visiteur anonyme ne doit pas pouvoir distinguer un
    // challenge non publié d'un challenge qui n'existe pas.
    const session = await verifyRequestToken(request);
    if (!session && !isPubliclyVisible(challenge)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Le type du challenge source, d'où les deux coquilles de page déduisent
    // le mode de validation (cas de référence vs scénario). Dérivé et non
    // stocké : une colonne `validation_mode` serait une seconde source de
    // vérité capable de dériver de la première. Une requête de plus seulement
    // pour un challenge qui en a un.
    const sourceChallenge = challenge.source_challenge_id
      ? await challengeRepo.findById(challenge.source_challenge_id)
      : null;

    const [team, tasks, meetings, repos, contributions, participants] = await Promise.all([
      challengeTeamRepo.findTeamMembers(id),
      taskRepo.findByChallenge(id),
      // `toPublicOverview` les écarte de toute façon : inutile de les lire.
      session ? syncMeetingRepo.findByChallengeId(id) : Promise.resolve([]),
      challengeRepoRepo.findByChallengeWithRepo(id),
      contributionRepo.findByChallenge(id),
      challengeTeamRepo.findByChallenge(id),
    ]);

    // Le board, la branche et la contribution sur lesquels travaille le
    // visiteur : les siens en solo, ceux du porteur s'il est en groupe. Dérivé
    // de `participants`, déjà chargé — aucune requête supplémentaire.
    const myWorkspaceOwnerId = session
      ? groupContextFrom(participants, session.userId).ownerId
      : null;

    // Qui travaille avec qui n'est pas un secret ; le jeton pour les rejoindre
    // en est un. On publie donc `group_owner_id` — un `user_id` déjà visible
    // dans `team`, qui identifie le groupe sans permettre d'y entrer — et on
    // masque `group_id`, qui est le lien d'invitation lui-même.
    const ownerByGroup = new Map<string, string>();
    for (const p of participants) {
      if (p.group_id && !ownerByGroup.has(p.group_id)) {
        ownerByGroup.set(p.group_id, pickGroupOwner(participants.filter(m => m.group_id === p.group_id)));
      }
    }
    const safeParticipants = participants.map(p => ({
      ...p,
      group_id: p.user_id === session?.userId ? p.group_id : undefined,
      group_owner_id: p.group_id ? ownerByGroup.get(p.group_id) ?? null : null,
    }));

    // Qui a produit chaque contribution de groupe. Seulement les identifiants :
    // les noms et avatars sont déjà dans `team`, le client fait la jointure.
    // `share_cp` n'y est pas — la répartition ne regarde pas la page.
    const contributionMembers = session
      ? (await contributionMemberRepo.findByContributions(contributions.map(c => c.uuid)))
          .map(m => ({ contribution_id: m.contribution_id, user_id: m.user_id }))
      : [];

    const payload = {
      challenge, team, tasks, meetings, repos, contributions,
      participants: safeParticipants,
      my_workspace_owner_id: myWorkspaceOwnerId,
      contribution_members: contributionMembers,
      source_challenge_type: sourceChallenge?.type ?? null,
    };

    // Sans session : la vitrine publique, y compris pour le prérendu SSR
    // (lib/server/publicSsr.ts), qui appelle cette route sans cookie.
    if (!session) {
      return NextResponse.json(toPublicOverview(payload));
    }

    const isAdmin = session.role === 'admin';
    const privileged = isAdmin || (await isManagerOfChallenge(session.userId, id));
    return NextResponse.json(toSignedInOverview(payload, {
      userId: session.userId,
      role: session.role,
      workspaceOwnerId: myWorkspaceOwnerId,
      isMember: participants.some(p => p.user_id === session.userId),
      privileged,
    }));
  } catch (error) {
    console.error('Error fetching challenge overview:', error);
    return NextResponse.json({ error: 'Failed to fetch challenge overview' }, { status: 500 });
  }
}
