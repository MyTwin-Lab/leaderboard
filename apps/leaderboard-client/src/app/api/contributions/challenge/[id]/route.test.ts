import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByChallenge, mockRewardFindByChallenge } = vi.hoisted(() => ({
  mockFindByChallenge: vi.fn(),
  mockRewardFindByChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findByChallenge = mockFindByChallenge;
  },
  RewardEntryRepository: class {
    findByChallenge = mockRewardFindByChallenge;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getContributions() {
  const req = new NextRequest(`http://localhost/api/contributions/challenge/${CHALLENGE_ID}`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByChallenge.mockResolvedValue([]);
  mockRewardFindByChallenge.mockResolvedValue([]);
});

describe('GET /api/contributions/challenge/[id]', () => {
  it('returns an empty list when the challenge has no contributions', async () => {
    const res = await getContributions();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('falls back to the cached reward when there are no ledger entries', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 42 }]);

    const res = await getContributions();
    const body = await res.json();

    expect(body).toEqual([{ uuid: 'c1', reward: 42 }]);
  });

  it('overrides the cached reward with the summed ledger total', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 0 }]);
    mockRewardFindByChallenge.mockResolvedValue([
      { contribution_id: 'c1', points: 30 },
      { contribution_id: 'c1', points: 15 },
    ]);

    const res = await getContributions();
    const body = await res.json();

    expect(body).toEqual([{ uuid: 'c1', reward: 45 }]);
  });

  it('ignores ledger entries without a contribution_id', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 5 }]);
    mockRewardFindByChallenge.mockResolvedValue([{ contribution_id: null, points: 100 }]);

    const res = await getContributions();
    const body = await res.json();

    expect(body).toEqual([{ uuid: 'c1', reward: 5 }]);
  });

  it('returns 500 when a repository call throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getContributions();

    expect(res.status).toBe(500);
  });
});
