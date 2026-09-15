import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockChallengeFindById, mockReadChallengeRewards, mockVerifyRequestToken, mockIsPubliclyVisible } = vi.hoisted(() => ({
  mockChallengeFindById: vi.fn(),
  mockReadChallengeRewards: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockIsPubliclyVisible: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  RewardEntryRepository: class {},
}));

vi.mock('../../../../../../../../packages/capabilities/rewards', () => ({
  readChallengeRewards: mockReadChallengeRewards,
}));

// lib/auth instancie des repositories au chargement : la session est mockée à part.
vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/public/challengeVisibility', () => ({ isPubliclyVisible: mockIsPubliclyVisible }));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';
const READING = {
  full: { pool: 1000, distributed: 420, remaining: 580, breakdown: [{ userId: 'u1', points: 420 }], metric: { name: 'auc' } },
  public: { metric: { name: 'auc' } },
};

function getRewards() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/rewards`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'admin' });
  mockIsPubliclyVisible.mockReturnValue(true);
  mockReadChallengeRewards.mockResolvedValue(READING);
});

describe('GET /api/challenges/[id]/rewards', () => {
  it('returns 404 when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(404);
    expect(mockReadChallengeRewards).not.toHaveBeenCalled();
  });

  it('hides a challenge that is not public from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockIsPubliclyVisible.mockReturnValue(false);

    const res = await getRewards();

    expect(res.status).toBe(404);
    expect(mockReadChallengeRewards).not.toHaveBeenCalled();
  });

  it('returns 400 when the flow has no reward pool (e.g. validation)', async () => {
    mockReadChallengeRewards.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(400);
  });

  it('serves the full reading to a signed-in caller', async () => {
    const res = await getRewards();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(READING.full);
  });

  it('serves only the public fields to an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(READING.public);
  });

  it('returns 500 when the repository throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockChallengeFindById.mockRejectedValue(new Error('db down'));

    const res = await getRewards();

    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
