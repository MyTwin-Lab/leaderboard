import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockFindByChallengeAndUser, mockRevealToken } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockRevealToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock('../../../../../../../../../packages/database-service/repositories/index.js', () => ({
  ComputeRequestRepository: class {
    findByChallengeAndUser = mockFindByChallengeAndUser;
  },
}));

vi.mock('../../../../../../../../../packages/services/compute/compute-request.service.js', () => ({
  ComputeRequestService: class {
    revealToken = mockRevealToken;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function postReveal() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-request/reveal-token`, {
    method: 'POST',
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
});

describe('POST /api/challenges/[id]/compute-request/reveal-token', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postReveal();

    expect(res.status).toBe(401);
    expect(mockFindByChallengeAndUser).not.toHaveBeenCalled();
  });

  it('returns 404 when the user has no compute request on this challenge', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    const res = await postReveal();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Compute request not found' });
    expect(mockRevealToken).not.toHaveBeenCalled();
  });

  it('returns 404 when the compute request belongs to someone else', async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'req-1', user_id: 'other-user' });

    const res = await postReveal();

    expect(res.status).toBe(404);
    expect(mockRevealToken).not.toHaveBeenCalled();
  });

  it('reveals the token for the owning contributor', async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'req-1', user_id: USER_ID });
    mockRevealToken.mockResolvedValue({ token: 'secret-token', jupyterUrl: 'http://jupyter.example' });

    const res = await postReveal();

    expect(res.status).toBe(200);
    expect(mockRevealToken).toHaveBeenCalledWith('req-1', USER_ID);
    expect(await res.json()).toEqual({ token: 'secret-token', jupyter_url: 'http://jupyter.example' });
  });

  it('returns 400 with the service error message when revealing fails', async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'req-1', user_id: USER_ID });
    mockRevealToken.mockRejectedValue(new Error('Cannot reveal token for a request in status "pending"'));

    const res = await postReveal();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Cannot reveal token for a request in status "pending"' });
  });

  it('falls back to a default message when the thrown error has none', async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'req-1', user_id: USER_ID });
    mockRevealToken.mockRejectedValue({});

    const res = await postReveal();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Failed to reveal token' });
  });
});
