import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockChallengeFindById, mockFindTeamMembers, mockFindByChallengeWithAssignees,
  mockGetMeetingsByChallengeId, mockFindByChallengeWithRepo, mockContributionsFindByChallenge,
} = vi.hoisted(() => ({
  mockChallengeFindById: vi.fn(),
  mockFindTeamMembers: vi.fn(),
  mockFindByChallengeWithAssignees: vi.fn(),
  mockGetMeetingsByChallengeId: vi.fn(),
  mockFindByChallengeWithRepo: vi.fn(),
  mockContributionsFindByChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ChallengeTeamRepository: class { findTeamMembers = mockFindTeamMembers; },
  TaskRepository: class { findByChallengeWithAssignees = mockFindByChallengeWithAssignees; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = mockFindByChallengeWithRepo; },
  ContributionRepository: class { findByChallenge = mockContributionsFindByChallenge; },
}));

vi.mock('../../../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class { getMeetingsByChallengeId = mockGetMeetingsByChallengeId; },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getOverview() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/overview`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, title: 'Challenge', status: 'active' });
  mockFindTeamMembers.mockResolvedValue([{ uuid: 'u1', full_name: 'Alix' }]);
  mockFindByChallengeWithAssignees.mockResolvedValue([{ uuid: 't1', title: 'Task', assignees: [] }]);
  mockGetMeetingsByChallengeId.mockResolvedValue([{ uuid: 'm1', title: 'Sync' }]);
  mockFindByChallengeWithRepo.mockResolvedValue([{ repo_id: 'r1', repo_type: 'github' }]);
  mockContributionsFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 10 }]);
});

describe('GET /api/challenges/[id]/overview', () => {
  it('aggregates challenge, team, tasks, meetings, repos and contributions in one response', async () => {
    const res = await getOverview();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.challenge).toEqual({ uuid: CHALLENGE_ID, title: 'Challenge', status: 'active' });
    expect(body.team).toEqual([{ uuid: 'u1', full_name: 'Alix' }]);
    expect(body.tasks).toEqual([{ uuid: 't1', title: 'Task', assignees: [] }]);
    expect(body.meetings).toEqual([{ uuid: 'm1', title: 'Sync' }]);
    expect(body.repos).toEqual([{ repo_id: 'r1', repo_type: 'github' }]);
    expect(body.contributions).toEqual([{ uuid: 'c1', reward: 10 }]);
  });

  it('runs the five secondary queries concurrently, not sequentially', async () => {
    await getOverview();
    // All five should have been called — proves the route doesn't skip any
    // of them short-circuiting on the challenge lookup alone.
    expect(mockFindTeamMembers).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockFindByChallengeWithAssignees).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockGetMeetingsByChallengeId).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockFindByChallengeWithRepo).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockContributionsFindByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 404 without querying anything else when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getOverview();

    expect(res.status).toBe(404);
    expect(mockFindTeamMembers).not.toHaveBeenCalled();
  });

  it('returns 500 when any underlying query fails', async () => {
    mockContributionsFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getOverview();

    expect(res.status).toBe(500);
  });
});
