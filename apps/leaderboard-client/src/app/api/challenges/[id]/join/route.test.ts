import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyRequestToken, mockFindByChallenge, mockCreate } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class {
    findByChallenge = mockFindByChallenge;
    create = mockCreate;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function join() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/join`, {
    method: 'POST',
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'user-1', role: 'contributor', email: 'a@b.com' });
  mockFindByChallenge.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'user-1' });
});

describe('POST /api/challenges/[id]/join', () => {
  it('adds the user to the challenge team', async () => {
    const res = await join();

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, message: 'Successfully joined the challenge' });
    expect(mockCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: 'user-1' });
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await join();

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the user is already a member', async () => {
    mockFindByChallenge.mockResolvedValue([{ challenge_id: CHALLENGE_ID, user_id: 'user-1' }]);

    const res = await join();

    expect(res.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await join();

    expect(res.status).toBe(500);
  });
});
