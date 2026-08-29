import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByChallengeWithRepo } = vi.hoisted(() => ({
  mockFindByChallengeWithRepo: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    findByChallengeWithRepo = mockFindByChallengeWithRepo;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getRepos() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/repos`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/challenges/[id]/repos', () => {
  it('returns the repos for the challenge', async () => {
    const repos = [{ repo_id: 'repo-1', repo_type: 'github', role: 'dataset' }];
    mockFindByChallengeWithRepo.mockResolvedValue(repos);

    const res = await getRepos();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(repos);
    expect(mockFindByChallengeWithRepo).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallengeWithRepo.mockRejectedValue(new Error('db down'));

    const res = await getRepos();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch challenge repos');
  });
});
