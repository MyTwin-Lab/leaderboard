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
  mockChallengeFindById,
  mockBestMetricValue,
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
  mockChallengeFindById: vi.fn(),
  mockBestMetricValue: vi.fn(),
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
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  RewardEntryRepository: class {
    bestMetricValue = mockBestMetricValue;
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
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, reward_rules: null });
  mockBestMetricValue.mockResolvedValue(null);
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

  describe('metric block threshold', () => {
    const withThreshold = (threshold: number) => ({
      uuid: CHALLENGE_ID,
      reward_rules: { model: { metric: { name: 'auc', baseline: 0, blockThreshold: threshold } } },
    });

    it('returns 403 for a dataset submission once the best metric reaches the threshold', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.9);

      const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://kaggle.com/datasets/a/b' });

      expect(res.status).toBe(403);
      expect(mockContributionCreate).not.toHaveBeenCalled();
      expect(mockScheduleAward).not.toHaveBeenCalled();
    });

    it('returns 403 for a model submission once the best metric reaches the threshold', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-model', role: 'model', workspace_meta: {} });
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.95); // past the threshold

      const res = await patchWorkspace({ repo_id: 'repo-model', workspace_url: 'https://kaggle.com/models/a/b' });

      expect(res.status).toBe(403);
    });

    it('returns 403 for a model_code submission once the best metric reaches the threshold', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-code', role: 'model_code', workspace_meta: {} });
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.9);

      const res = await patchWorkspace({ repo_id: 'repo-code', workspace_url: 'https://github.com/a/b' });

      expect(res.status).toBe(403);
    });

    it('still accepts an api submission once the threshold is reached', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-api', role: 'api', workspace_meta: {} });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-api', role: 'api', workspace_meta: {} });
      mockFindByChallengeWithRepo.mockResolvedValue([{ repo_id: 'repo-api', role: 'api', workspace_meta: {} }]);
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.95);

      const res = await patchWorkspace({ repo_id: 'repo-api', workspace_url: 'https://github.com/a/api' });

      expect(res.status).toBe(200);
    });

    it('still allows clearing your own dataset submission (workspace_url: null) past the threshold', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://old.com' } },
      });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.95);

      const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: null });

      expect(res.status).toBe(200);
    });

    it('still allows toggling a community dataset pick (dataset_urls) past the threshold', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.95);

      const res = await patchWorkspace({ repo_id: 'repo-1', dataset_urls: ['https://kaggle.com/datasets/a/b'] });

      expect(res.status).toBe(200);
    });

    it('allows a dataset submission when a threshold is configured but not yet reached', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockFindByChallengeWithRepo.mockResolvedValue([{ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} }]);
      mockChallengeFindById.mockResolvedValue(withThreshold(0.9));
      mockBestMetricValue.mockResolvedValue(0.8);

      const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://kaggle.com/datasets/a/b' });

      expect(res.status).toBe(200);
    });

    it('allows a dataset submission when no threshold is configured at all', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockFindByChallengeWithRepo.mockResolvedValue([{ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} }]);
      mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, reward_rules: null });

      const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://kaggle.com/datasets/a/b' });

      expect(res.status).toBe(200);
      expect(mockBestMetricValue).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockFindByChallengeAndRepo.mockRejectedValue(new Error('db down'));

    const res = await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://x.com' });

    expect(res.status).toBe(500);
  });

  describe('dataset_urls — community multi-select', () => {
    it('returns 400 when dataset_urls is not an array of non-empty strings', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });

      const res = await patchWorkspace({ repo_id: 'repo-1', dataset_urls: ['ok', ''] });

      expect(res.status).toBe(400);
    });

    it('returns 400 when dataset_urls targets a non-dataset repo', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'model', workspace_meta: {} });

      const res = await patchWorkspace({ repo_id: 'repo-1', dataset_urls: ['https://kaggle.com/datasets/a/b'] });

      expect(res.status).toBe(400);
    });

    it('stores the set under workspace_meta.datasetUrls without touching userUrls, the contribution or scheduleAward', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockUpdateWorkspace.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset',
        workspace_meta: { datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/alice/a'] } },
      });

      const res = await patchWorkspace({ repo_id: 'repo-1', dataset_urls: ['https://kaggle.com/datasets/alice/a'] });

      expect(res.status).toBe(200);
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
        workspace_meta: { datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/alice/a'] } },
      });
      expect(mockContributionCreate).not.toHaveBeenCalled();
      expect(mockContributionUpdate).not.toHaveBeenCalled();
      expect(mockScheduleAward).not.toHaveBeenCalled();
    });

    it('dedupes urls and clears the key when the array is empty', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset',
        workspace_meta: { datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/alice/a'] } },
      });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: { datasetUrls: {} } });

      const res = await patchWorkspace({ repo_id: 'repo-1', dataset_urls: [] });

      expect(res.status).toBe(200);
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
        workspace_meta: { datasetUrls: {} },
      });
    });

    it('preserves other users\' picks when updating this one', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset',
        workspace_meta: { datasetUrls: { 'other-user': ['https://kaggle.com/datasets/dave/d'] } },
      });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });

      await patchWorkspace({ repo_id: 'repo-1', dataset_urls: ['https://kaggle.com/datasets/alice/a'] });

      expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
        workspace_meta: {
          datasetUrls: {
            'other-user': ['https://kaggle.com/datasets/dave/d'],
            [USER_ID]: ['https://kaggle.com/datasets/alice/a'],
          },
        },
      });
    });

    it('syncs datasetUrls when the own workspace_url is submitted, keeping community picks already checked', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset',
        workspace_meta: {
          userUrls: { [USER_ID]: 'https://kaggle.com/datasets/old/mine' },
          datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/old/mine', 'https://kaggle.com/datasets/alice/a'] },
        },
      });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });
      mockFindByChallengeWithRepo.mockResolvedValue([
        { repo_id: 'repo-1', role: 'dataset', workspace_meta: { userUrls: { [USER_ID]: 'https://kaggle.com/datasets/new/mine' } } },
      ]);
      mockContributionFindByChallenge.mockResolvedValue([]);
      mockContributionCreate.mockResolvedValue({ uuid: 'contrib-1' });

      await patchWorkspace({ repo_id: 'repo-1', workspace_url: 'https://kaggle.com/datasets/new/mine' });

      expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
        workspace_meta: {
          userUrls: { [USER_ID]: 'https://kaggle.com/datasets/new/mine' },
          datasetUrls: {
            [USER_ID]: expect.arrayContaining([
              'https://kaggle.com/datasets/new/mine',
              'https://kaggle.com/datasets/alice/a',
            ]),
          },
        },
      });
    });

    it('drops the own entry from datasetUrls when workspace_url is cleared, keeping community picks', async () => {
      mockFindByChallengeAndRepo.mockResolvedValue({
        repo_id: 'repo-1', role: 'dataset',
        workspace_meta: {
          userUrls: { [USER_ID]: 'https://kaggle.com/datasets/old/mine' },
          datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/old/mine', 'https://kaggle.com/datasets/alice/a'] },
        },
      });
      mockUpdateWorkspace.mockResolvedValue({ repo_id: 'repo-1', role: 'dataset', workspace_meta: {} });

      await patchWorkspace({ repo_id: 'repo-1', workspace_url: null });

      expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'repo-1', {
        workspace_meta: {
          userUrls: {},
          datasetUrls: { [USER_ID]: ['https://kaggle.com/datasets/alice/a'] },
        },
      });
    });
  });
});
