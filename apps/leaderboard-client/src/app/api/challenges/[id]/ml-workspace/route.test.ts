import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify,
  mockFindByChallengeWithRepo,
  mockFindByChallengeAndRepo,
  mockUpdateWorkspace,
  mockFindByIds,
  mockContributionFindByChallenge,
  mockContributionUpdate,
  mockContributionCreate,
  mockTeamFindByChallenge,
  mockTeamCreate,
  mockNormalizeArtifactUrl,
  mockScheduleAward,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockFindByChallengeWithRepo: vi.fn(),
  mockFindByChallengeAndRepo: vi.fn(),
  mockUpdateWorkspace: vi.fn(),
  mockFindByIds: vi.fn(),
  mockContributionFindByChallenge: vi.fn(),
  mockContributionUpdate: vi.fn(),
  mockContributionCreate: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
  mockTeamCreate: vi.fn(),
  mockNormalizeArtifactUrl: vi.fn(),
  mockScheduleAward: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    findByChallengeWithRepo = mockFindByChallengeWithRepo;
    findByChallengeAndRepo = mockFindByChallengeAndRepo;
    updateWorkspace = mockUpdateWorkspace;
  },
  UserRepository: class {
    findByIds = mockFindByIds;
  },
  ContributionRepository: class {
    findByChallenge = mockContributionFindByChallenge;
    update = mockContributionUpdate;
    create = mockContributionCreate;
  },
  ChallengeTeamRepository: class {
    findByChallenge = mockTeamFindByChallenge;
    create = mockTeamCreate;
  },
}));

vi.mock('../../../../../../../../packages/services/challenge/artifactUrl', () => ({
  normalizeArtifactUrl: mockNormalizeArtifactUrl,
}));

vi.mock('../../../../../../../../packages/services/challenge/ml-rewards.service', () => ({
  MlRewardsService: class {
    scheduleAward = mockScheduleAward;
  },
}));

import { GET, PATCH } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function getWorkspace(withSession = false) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/ml-workspace`, {
    headers: withSession ? { cookie: 'access_token=fake-token' } : {},
  });
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function patchWorkspace(body: unknown, withSession = true) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/ml-workspace`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(withSession ? { cookie: 'access_token=fake-token' } : {}),
    },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: USER_ID, role: 'contributor' } });
  mockFindByChallengeWithRepo.mockResolvedValue([]);
  mockFindByIds.mockResolvedValue([]);
  mockTeamFindByChallenge.mockResolvedValue([{ challenge_id: CHALLENGE_ID, user_id: USER_ID }]);
  mockTeamCreate.mockResolvedValue(undefined);
  mockContributionFindByChallenge.mockResolvedValue([]);
  mockNormalizeArtifactUrl.mockImplementation((url: string) => url);
});

describe('GET /api/challenges/[id]/ml-workspace', () => {
  it('returns repos with resolved submitter users and currentUserId null when unauthenticated', async () => {
    mockFindByChallengeWithRepo.mockResolvedValue([
      {
        repo_id: 'repo-1',
        repo_type: 'github',
        repo_external_id: 'ext-1',
        role: 'dataset',
        workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } },
      },
    ]);
    mockFindByIds.mockResolvedValue([{ uuid: USER_ID, full_name: 'Ada', avatar_url: 'a.png' }]);

    const res = await getWorkspace(false);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentUserId).toBeNull();
    expect(body.repos).toEqual([
      {
        repo_id: 'repo-1',
        repo_type: 'github',
        repo_external_id: 'ext-1',
        role: 'dataset',
        workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } },
      },
    ]);
    expect(body.users).toEqual({ [USER_ID]: { fullName: 'Ada', avatarUrl: 'a.png' } });
    expect(mockFindByIds).toHaveBeenCalledWith([USER_ID]);
  });

  it('returns currentUserId when a valid session cookie is present', async () => {
    const res = await getWorkspace(true);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentUserId).toBe(USER_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallengeWithRepo.mockRejectedValue(new Error('db down'));

    const res = await getWorkspace(false);

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/challenges/[id]/ml-workspace', () => {
  it('returns 401 when there is no session cookie', async () => {
    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://x.com' }, false);

    expect(res.status).toBe(401);
  });

  it('returns 400 when repo_id is missing, without joining the challenge team', async () => {
    mockTeamFindByChallenge.mockResolvedValue([]);

    const res = await patchWorkspace({ workspace_url: 'https://x.com' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/repo_id/);
    expect(mockTeamCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when neither workspace_url nor live_endpoint_url is provided', async () => {
    const res = await patchWorkspace({ repo_id: 'repo-1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when workspace_url is an empty string', async () => {
    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when live_endpoint_url is an empty string', async () => {
    const res = await patchWorkspace({ repo_id: 'repo-1', live_endpoint_url: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the repo does not belong to this challenge, without joining the challenge team', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue(null);
    mockTeamFindByChallenge.mockResolvedValue([]);

    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://github.com/a/b' });

    expect(res.status).toBe(404);
    expect(mockTeamCreate).not.toHaveBeenCalled();
  });

  it('adds the user to the challenge team when they are not already a member', async () => {
    mockTeamFindByChallenge.mockResolvedValue([]);
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });

    await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://github.com/a/b' });

    expect(mockTeamCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: USER_ID });
  });

  it('does not re-add the user to the team when already a member', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });

    await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://github.com/a/b' });

    expect(mockTeamCreate).not.toHaveBeenCalled();
  });

  it('saves the workspace_url, creates a new contribution and schedules the ML award', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } },
    });
    mockFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } } },
    ]);
    mockContributionFindByChallenge.mockResolvedValue([]);
    mockContributionCreate.mockResolvedValue({ uuid: 'contrib-1' });

    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://github.com/a/b' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.repo.workspace_meta.userUrls[USER_ID]).toBe('https://github.com/a/b');
    expect(mockContributionCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dataset',
      user_id: USER_ID,
      challenge_id: CHALLENGE_ID,
      artifact_url: 'https://github.com/a/b',
      evaluation_status: 'pending',
    }));
    expect(mockScheduleAward).toHaveBeenCalledWith({
      challengeId: CHALLENGE_ID,
      userId: USER_ID,
      repoId: 'repo-1',
      url: 'https://github.com/a/b',
    });
  });

  it('updates the existing contribution instead of creating a new one', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } },
    });
    mockFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://github.com/a/b' } } },
    ]);
    mockContributionFindByChallenge.mockResolvedValue([
      { uuid: 'contrib-1', user_id: USER_ID, type: 'dataset' },
    ]);

    await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://github.com/a/b' });

    expect(mockContributionCreate).not.toHaveBeenCalled();
    expect(mockContributionUpdate).toHaveBeenCalledWith('contrib-1', expect.objectContaining({
      evaluation_status: 'pending',
      artifact_url: 'https://github.com/a/b',
    }));
  });

  it('removes the user url and skips contribution/reward work when workspace_url is null', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://old.com' } },
    });
    mockUpdateWorkspace.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: {} },
    });

    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: null });

    expect(res.status).toBe(200);
    expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
      workspace_meta: { userUrls: {} },
    });
    expect(mockContributionCreate).not.toHaveBeenCalled();
    expect(mockContributionUpdate).not.toHaveBeenCalled();
    expect(mockScheduleAward).not.toHaveBeenCalled();
  });

  it('saves the live_endpoint_url for an api-role repo and updates the matching contribution', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'api', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({
      repo_id: 'repo-1', role: 'api', workspace_meta: { userEndpoints: { [USER_ID]: 'https://live.example.com' } },
    });
    mockContributionFindByChallenge.mockResolvedValue([
      { uuid: 'contrib-2', user_id: USER_ID, type: 'api_packaging' },
    ]);

    const res = await patchWorkspace({ repo_id: 'repo-1', live_endpoint_url: 'https://live.example.com' });

    expect(res.status).toBe(200);
    expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
      workspace_meta: { userEndpoints: { [USER_ID]: 'https://live.example.com' } },
    });
    expect(mockContributionUpdate).toHaveBeenCalledWith('contrib-2', { live_endpoint_url: 'https://live.example.com' });
  });

  it('does not touch userEndpoints when the repo role is not api', async () => {
    mockFindByChallengeAndRepo.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: {},
    });
    mockUpdateWorkspace.mockResolvedValue({
      repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://x.com' } },
    });
    mockFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://x.com' } } },
    ]);

    await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://x.com', live_endpoint_url: 'https://live.example.com' });

    expect(mockContributionUpdate).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ live_endpoint_url: expect.anything() }));
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockFindByChallengeAndRepo.mockRejectedValue(new Error('db down'));

    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://x.com' });

    expect(res.status).toBe(500);
  });
});
