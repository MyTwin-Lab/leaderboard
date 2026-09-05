import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  TaskRepository,
  ChallengeRepoRepository,
  ContributionRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { SyncMeetingService } from '../../../../../../../../packages/services/sync-meeting/sync-meeting.service.js';
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicOverview } from '@/lib/public/overview';
import { groupContextFrom, pickGroupOwner } from '../../../../../../../../packages/services/challenge/group';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const contributionRepo = new ContributionRepository();

// GET /api/challenges/[id]/overview
//
// Aggregates the challenge-scoped reads that both /challenges/[id] (public)
// and /challenges/[id]/manage (ChallengeManageView) need — challenge, team,
// tasks+assignees, meetings, repos, contributions, participants — into a
// single response. Shared by both pages/components with the same
// react-query key, so navigating between them reuses the cache instead of
// re-fetching.
//
// Each field is the same raw shape its former standalone endpoint returned
// (/team, /tasks?include=assignees, /sync-meetings, /repos,
// /contributions/challenge/[id]) — callers map fields client-side exactly as
// before, nothing changed there. `participants` is the raw
// ChallengeTeam[] (workspace fields included) — the personal-board UI
// (tasks 11/13) reads workspace status per contributor from it.
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

    const [team, tasks, meetings, repos, contributions, participants] = await Promise.all([
      challengeTeamRepo.findTeamMembers(id),
      taskRepo.findByChallenge(id),
      new SyncMeetingService().getMeetingsByChallengeId(id),
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

    const payload = {
      challenge, team, tasks, meetings, repos, contributions,
      participants: safeParticipants,
      my_workspace_owner_id: myWorkspaceOwnerId,
    };
    return NextResponse.json(session ? payload : toPublicOverview(payload));
  } catch (error) {
    console.error('Error fetching challenge overview:', error);
    return NextResponse.json({ error: 'Failed to fetch challenge overview' }, { status: 500 });
  }
}
