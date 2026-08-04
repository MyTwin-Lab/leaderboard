import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockComputeChallengeRewards } = vi.hoisted(() => ({
  mockComputeChallengeRewards: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/challenge.service', () => ({
  ChallengeService: class {
    computeChallengeRewards = mockComputeChallengeRewards;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function postClose() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/close`, { method: 'POST' });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/challenges/[id]/close', () => {
  it('closes the challenge and returns the computed rewards', async () => {
    const rewards = [{ userId: 'user-1', cp: 10 }, { userId: 'user-2', cp: 5 }];
    mockComputeChallengeRewards.mockResolvedValue(rewards);

    const res = await postClose();

    expect(res.status).toBe(200);
    expect(mockComputeChallengeRewards).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual({ success: true, count: 2, rewards });
  });

  it('returns an empty rewards list when there is nothing to distribute', async () => {
    mockComputeChallengeRewards.mockResolvedValue([]);

    const res = await postClose();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 0, rewards: [] });
  });

  it('returns 500 when computing rewards fails', async () => {
    mockComputeChallengeRewards.mockRejectedValue(new Error('db down'));

    const res = await postClose();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to close challenge' });
  });
});
