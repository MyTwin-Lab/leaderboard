import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetChallengeContext } = vi.hoisted(() => ({
  mockGetChallengeContext: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/challenge.service', () => ({
  ChallengeService: class {
    getChallengeContext = mockGetChallengeContext;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getContext() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/context`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/challenges/[id]/context', () => {
  it('returns the challenge context', async () => {
    const context = { challenge: { uuid: CHALLENGE_ID }, tasks: [], contributions: [] };
    mockGetChallengeContext.mockResolvedValue(context);

    const res = await getContext();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(context);
    expect(mockGetChallengeContext).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 500 when the service throws', async () => {
    mockGetChallengeContext.mockRejectedValue(new Error('db down'));

    const res = await getContext();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch challenge context');
  });
});
