import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByChallenge } = vi.hoisted(() => ({
  mockFindByChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findByChallenge = mockFindByChallenge;
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
});

describe('GET /api/contributions/challenge/[id]', () => {
  it('returns an empty list when the challenge has no contributions', async () => {
    const res = await getContributions();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  // contributions.reward is kept in sync with the reward_entries ledger by
  // trg_sync_contribution_reward (drizzle/0018_reward_ledger_sync_trigger.sql),
  // so this route just passes the cached column through — no ledger lookup.
  it('returns the cached reward as-is, trusting the DB trigger to keep it in sync', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 45 }]);

    const res = await getContributions();
    const body = await res.json();

    expect(body).toEqual([{ uuid: 'c1', reward: 45 }]);
  });

  it('returns 500 when the repository call throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getContributions();

    expect(res.status).toBe(500);
  });
});
