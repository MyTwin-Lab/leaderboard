import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindChallengesByRepo } = vi.hoisted(() => ({
  mockFindChallengesByRepo: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    findChallengesByRepo = mockFindChallengesByRepo;
  },
}));

import { GET } from './route';

const REPO_ID = 'repo-1';

function getRepoChallenges() {
  const req = new NextRequest(`http://localhost/api/repos/${REPO_ID}/challenges`);
  return GET(req, { params: Promise.resolve({ id: REPO_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/repos/[id]/challenges', () => {
  it('returns the challenges linked to the repo', async () => {
    const challenges = [{ uuid: 'c1', title: 'Challenge 1' }];
    mockFindChallengesByRepo.mockResolvedValue(challenges);

    const res = await getRepoChallenges();

    expect(res.status).toBe(200);
    expect(mockFindChallengesByRepo).toHaveBeenCalledWith(REPO_ID);
    expect(await res.json()).toEqual(challenges);
  });

  it('returns an empty array when the repo has no linked challenges', async () => {
    mockFindChallengesByRepo.mockResolvedValue([]);

    const res = await getRepoChallenges();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindChallengesByRepo.mockRejectedValue(new Error('db down'));

    const res = await getRepoChallenges();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch repo challenges' });
  });
});
