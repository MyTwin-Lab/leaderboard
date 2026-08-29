import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockChallengeFindById, mockFindByChallenge, mockFindByIds } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockFindByIds: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  RewardEntryRepository: class {
    findByChallenge = mockFindByChallenge;
  },
  UserRepository: class {
    findByIds = mockFindByIds;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getRewards() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-rewards`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindByChallenge.mockResolvedValue([]);
  mockFindByIds.mockResolvedValue([]);
});

describe('GET /api/challenges/[id]/validation-rewards', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(401);
    expect(mockChallengeFindById).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await getRewards();

    expect(res.status).toBe(403);
  });

  it('allows a manager (non-admin) who manages the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 100,
      required_validations: 3, cp_per_validation: 5,
    });

    const res = await getRewards();

    expect(res.status).toBe(200);
  });

  it('returns 404 when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(404);
  });

  it('returns 400 when the challenge is not a validation challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });

    const res = await getRewards();

    expect(res.status).toBe(400);
  });

  it('computes pool state and a per-validator breakdown sorted by points desc', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 100,
      required_validations: 3, cp_per_validation: 5,
    });
    mockFindByChallenge.mockResolvedValue([
      { user_id: 'u1', points: 10 },
      { user_id: 'u2', points: 30 },
      { user_id: 'u1', points: 5 },
    ]);
    mockFindByIds.mockResolvedValue([
      { uuid: 'u1', full_name: 'Alice' },
      { uuid: 'u2', full_name: 'Bob' },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pool).toBe(100);
    expect(body.distributed).toBe(45);
    expect(body.remaining).toBe(55);
    expect(body.requiredValidations).toBe(3);
    expect(body.cpPerValidation).toBe(5);
    expect(body.breakdown).toEqual([
      { userId: 'u2', userName: 'Bob', points: 30 },
      { userId: 'u1', userName: 'Alice', points: 15 },
    ]);
  });

  it('clamps remaining to 0 when distributed exceeds the pool', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 10,
      required_validations: null, cp_per_validation: null,
    });
    mockFindByChallenge.mockResolvedValue([{ user_id: 'u1', points: 50 }]);
    mockFindByIds.mockResolvedValue([{ uuid: 'u1', full_name: 'Alice' }]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.remaining).toBe(0);
    expect(body.requiredValidations).toBe(0);
    expect(body.cpPerValidation).toBe(0);
  });

  it('falls back to "Unknown" for a user that cannot be resolved', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 10,
    });
    mockFindByChallenge.mockResolvedValue([{ user_id: 'u1', points: 5 }]);
    mockFindByIds.mockResolvedValue([]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.breakdown).toEqual([{ userId: 'u1', userName: 'Unknown', points: 5 }]);
  });

  it('returns 500 when a repository call throws', async () => {
    mockChallengeFindById.mockRejectedValue(new Error('db down'));

    const res = await getRewards();

    expect(res.status).toBe(500);
  });
});
