import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser, mockIsManagerOfChallenge,
  mockChallengeFindById, mockContributionFindByChallenge, mockContributionFindById, mockContributionUpdate,
  mockTargetFindByChallenge, mockTargetFindByChallengeAndContribution, mockTargetCreate,
  mockAttemptFindByChallengeAndValidator, mockAttemptFindByChallengeAndContribution,
  mockRewardSumByChallenge, mockUserFindByIds, mockAssertPublicHttpUrl,
  mockCaseClaimFindByValidatorAndTarget,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockContributionFindByChallenge: vi.fn(),
  mockContributionFindById: vi.fn(),
  mockContributionUpdate: vi.fn(),
  mockTargetFindByChallenge: vi.fn(),
  mockTargetFindByChallengeAndContribution: vi.fn(),
  mockTargetCreate: vi.fn(),
  mockAttemptFindByChallengeAndValidator: vi.fn(),
  mockAttemptFindByChallengeAndContribution: vi.fn(),
  mockRewardSumByChallenge: vi.fn(),
  mockUserFindByIds: vi.fn(),
  mockAssertPublicHttpUrl: vi.fn(),
  mockCaseClaimFindByValidatorAndTarget: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../packages/services/challenge/ssrf-guard', () => ({
  assertPublicHttpUrl: mockAssertPublicHttpUrl,
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ContributionRepository: class {
    findByChallenge = mockContributionFindByChallenge;
    findById = mockContributionFindById;
    update = mockContributionUpdate;
  },
  ValidationTargetRepository: class {
    findByChallenge = mockTargetFindByChallenge;
    findByChallengeAndContribution = mockTargetFindByChallengeAndContribution;
    create = mockTargetCreate;
  },
  ValidationAttemptRepository: class {
    findByChallengeAndValidator = mockAttemptFindByChallengeAndValidator;
    findByChallengeAndContribution = mockAttemptFindByChallengeAndContribution;
  },
  RewardEntryRepository: class {
    sumByChallenge = mockRewardSumByChallenge;
  },
  UserRepository: class {
    findByIds = mockUserFindByIds;
  },
  CaseClaimRepository: class {
    findByValidatorAndTarget = mockCaseClaimFindByValidatorAndTarget;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const CONTRIBUTION_ID = '11111111-1111-4111-8111-111111111111';

function getTargets(query = '') {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-targets${query}`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postTarget(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

const VALIDATION_CHALLENGE = {
  uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 100,
  cp_per_validation: 5, required_validations: 3, source_challenge_id: 'ml-challenge-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(null);
  mockChallengeFindById.mockResolvedValue(VALIDATION_CHALLENGE);
  mockContributionFindByChallenge.mockResolvedValue([]);
  mockTargetFindByChallenge.mockResolvedValue([]);
  mockTargetFindByChallengeAndContribution.mockResolvedValue(null);
  mockAttemptFindByChallengeAndValidator.mockResolvedValue([]);
  mockAttemptFindByChallengeAndContribution.mockResolvedValue([]);
  mockRewardSumByChallenge.mockResolvedValue(0);
  mockUserFindByIds.mockResolvedValue([]);
  mockAssertPublicHttpUrl.mockResolvedValue(undefined);
  mockCaseClaimFindByValidatorAndTarget.mockResolvedValue([]);
});

describe('GET /api/challenges/[id]/validation-targets', () => {
  it('returns 400 when the challenge is not a validation challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });

    const res = await getTargets();

    expect(res.status).toBe(400);
  });

  it('returns 400 when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getTargets();

    expect(res.status).toBe(400);
  });

  describe('?eligible=true', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await getTargets('?eligible=true');
      expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin who does not manage the challenge', async () => {
      mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
      mockIsManagerOfChallenge.mockResolvedValue(false);

      const res = await getTargets('?eligible=true');

      expect(res.status).toBe(403);
    });

    it('lists api_packaging contributions that are not already a target, regardless of whether an endpoint is already saved', async () => {
      mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
      mockContributionFindByChallenge.mockResolvedValue([
        { uuid: 'c1', type: 'api_packaging', live_endpoint_url: 'https://x', user_id: 'u1' },
        { uuid: 'c2', type: 'api_packaging', live_endpoint_url: null, user_id: 'u2' },
        { uuid: 'c3', type: 'dataset', live_endpoint_url: 'https://y', user_id: 'u3' },
        { uuid: 'c4', type: 'api_packaging', live_endpoint_url: 'https://z', user_id: 'u4' },
      ]);
      mockTargetFindByChallenge.mockResolvedValue([{ contribution_id: 'c4' }]);
      mockUserFindByIds.mockResolvedValue([{ uuid: 'u1', full_name: 'Alice' }, { uuid: 'u2', full_name: 'Bob' }]);

      const res = await getTargets('?eligible=true');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.eligible).toEqual([
        { contributionId: 'c1', userId: 'u1', userName: 'Alice' },
        { contributionId: 'c2', userId: 'u2', userName: 'Bob' },
      ]);
    });

    it('returns an empty eligible list when the challenge has no source challenge', async () => {
      mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
      mockChallengeFindById.mockResolvedValue({ ...VALIDATION_CHALLENGE, source_challenge_id: null });

      const res = await getTargets('?eligible=true');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.eligible).toEqual([]);
      expect(mockContributionFindByChallenge).not.toHaveBeenCalled();
    });
  });

  it('returns pool state and targets without a session (public)', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 't1', contribution_id: 'c1', outcome: 'pending', resolved_at: null },
    ]);
    mockRewardSumByChallenge.mockResolvedValue(15);
    mockContributionFindById.mockResolvedValue({ uuid: 'c1', user_id: 'u1' });
    mockUserFindByIds.mockResolvedValue([{ uuid: 'u1', full_name: 'Alice', avatar_url: null }]);
    mockAttemptFindByChallengeAndContribution.mockResolvedValue([
      { verdict: 'works' }, { verdict: 'broken' }, { verdict: 'works' },
    ]);

    const res = await getTargets();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentUserId).toBeNull();
    expect(body.pool).toEqual({ pool: 100, distributed: 15, remaining: 85, cpPerValidation: 5, requiredValidations: 3 });
    expect(body.targets).toHaveLength(1);
    const target = body.targets[0];
    expect(target.submitterName).toBe('Alice');
    expect(target.alreadyValidatedByMe).toBe(false);
    expect(target.verdictCount).toBe(3);
    // Non-manager, anonymous viewer: no worksCount/brokenCount leak.
    expect(target.worksCount).toBeUndefined();
    expect(target.brokenCount).toBeUndefined();
  });

  it('exposes worksCount/brokenCount and alreadyValidatedByMe to the manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 't1', contribution_id: 'c1', outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: 'c1', user_id: 'u1' });
    mockUserFindByIds.mockResolvedValue([{ uuid: 'u1', full_name: 'Alice', avatar_url: null }]);
    mockAttemptFindByChallengeAndValidator.mockResolvedValue([{ contribution_id: 'c1' }]);
    mockAttemptFindByChallengeAndContribution.mockResolvedValue([{ verdict: 'works' }, { verdict: 'broken' }]);

    const res = await getTargets();
    const body = await res.json();

    expect(body.currentUserId).toBe('admin-1');
    expect(body.targets[0].alreadyValidatedByMe).toBe(true);
    expect(body.targets[0].worksCount).toBe(1);
    expect(body.targets[0].brokenCount).toBe(1);
  });

  it('exposes worksCount/brokenCount to a manager who is not an admin', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 't1', contribution_id: 'c1', outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: 'c1', user_id: 'u2' });

    const res = await getTargets();
    const body = await res.json();

    expect(body.targets[0].worksCount).toBe(0);
    expect(body.targets[0].brokenCount).toBe(0);
  });

  it('handles a target whose contribution was deleted (submitter falls back to null/Unknown)', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 't1', contribution_id: 'c1', outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue(null);

    const res = await getTargets();
    const body = await res.json();

    expect(body.targets[0].submitterUserId).toBeNull();
    expect(body.targets[0].submitterName).toBe('Unknown');
  });

  it('returns 500 when a repository call throws', async () => {
    mockTargetFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getTargets();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/challenges/[id]/validation-targets', () => {
  const eligibleContribution = {
    uuid: CONTRIBUTION_ID, challenge_id: 'ml-challenge-1', type: 'api_packaging', live_endpoint_url: null,
  };
  const LIVE_URL = 'https://model.example.com/predict';

  beforeEach(() => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockContributionFindById.mockResolvedValue(eligibleContribution);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(401);
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(403);
  });

  it('returns 400 when the challenge is not a validation challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postTarget({ contribution_id: 'not-a-uuid', live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when live_endpoint_url is missing or not a valid URL', async () => {
    expect((await postTarget({ contribution_id: CONTRIBUTION_ID })).status).toBe(400);
    expect((await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: 'not-a-url' })).status).toBe(400);
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the contribution is not from the source challenge', async () => {
    mockContributionFindById.mockResolvedValue({ ...eligibleContribution, challenge_id: 'other-challenge' });

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
  });

  it('returns 400 when the contribution is not api_packaging', async () => {
    mockContributionFindById.mockResolvedValue({ ...eligibleContribution, type: 'dataset' });

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
  });

  it('returns 400 when the contribution does not exist', async () => {
    mockContributionFindById.mockResolvedValue(null);

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
  });

  it('returns 409 when the contribution is already a target', async () => {
    mockTargetFindByChallengeAndContribution.mockResolvedValue({ uuid: 'existing-target' });

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(409);
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the endpoint fails the SSRF guard', async () => {
    mockAssertPublicHttpUrl.mockRejectedValue(new Error('blocked: private address'));

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(400);
    expect(mockContributionUpdate).not.toHaveBeenCalled();
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });

  it('saves the endpoint on the contribution, then creates the target on success', async () => {
    const created = { uuid: 'new-target', validation_challenge_id: CHALLENGE_ID, contribution_id: CONTRIBUTION_ID, position: 0 };
    mockTargetCreate.mockResolvedValue(created);

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(LIVE_URL);
    expect(mockContributionUpdate).toHaveBeenCalledWith(CONTRIBUTION_ID, { live_endpoint_url: LIVE_URL });
    expect(mockTargetCreate).toHaveBeenCalledWith({
      validation_challenge_id: CHALLENGE_ID, contribution_id: CONTRIBUTION_ID, position: 0,
    });
    expect(body).toEqual(created);
  });

  it('returns 500 on an unexpected error', async () => {
    mockTargetCreate.mockRejectedValue(new Error('db down'));

    const res = await postTarget({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL });

    expect(res.status).toBe(500);
  });
});
