import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  TaskRepository,
  ChallengeRepoRepository,
  ContributionRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { SyncMeetingService } from '../../../../../../../../packages/services/sync-meeting/sync-meeting.service.js';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const contributionRepo = new ContributionRepository();

// GET /api/challenges/[id]/overview
//
// Aggregates the challenge-scoped reads that both /challenges/[id] (public)
// and /challenges/[id]/manage (ChallengeManageView) need — challenge, team,
// tasks+assignees, meetings, repos, contributions — into a single response.
// Shared by both pages/components with the same react-query key, so
// navigating between them reuses the cache instead of re-fetching.
//
// Each field is the same raw shape its former standalone endpoint returned
// (/team, /tasks?include=assignees, /sync-meetings, /repos,
// /contributions/challenge/[id]) — callers map fields client-side exactly as
// before, nothing changed there.
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

    const [team, tasks, meetings, repos, contributions] = await Promise.all([
      challengeTeamRepo.findTeamMembers(id),
      taskRepo.findByChallengeWithAssignees(id),
      new SyncMeetingService().getMeetingsByChallengeId(id),
      challengeRepoRepo.findByChallengeWithRepo(id),
      contributionRepo.findByChallenge(id),
    ]);

    return NextResponse.json({ challenge, team, tasks, meetings, repos, contributions });
  } catch (error) {
    console.error('Error fetching challenge overview:', error);
    return NextResponse.json({ error: 'Failed to fetch challenge overview' }, { status: 500 });
  }
}
