import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByChallenge, mockGetSessionUser } = vi.hoisted(() => ({
  mockFindByChallenge: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findByChallenge = mockFindByChallenge;
  },
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getContributions() {
  const req = new NextRequest(`http://localhost/api/contributions/challenge/${CHALLENGE_ID}`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByChallenge.mockResolvedValue([]);
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/contributions/challenge/[id]', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await getContributions();

    expect(res.status).toBe(401);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  // Les lignes portent l'évaluation IA privée de chaque auteur.
  it('returns 403 for a contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });

    const res = await getContributions();

    expect(res.status).toBe(403);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns the full rows, evaluation included, to an admin', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 'c1', reward: 10, evaluation: { globalScore: 82 } }]);

    const res = await getContributions();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].evaluation).toEqual({ globalScore: 82 });
  });

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
