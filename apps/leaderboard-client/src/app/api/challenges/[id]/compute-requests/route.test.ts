import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindById, mockFindByChallenge, mockFindByIds } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindById: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockFindByIds: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock('@/lib/server/managerAuth', () => ({
  isManagerOfChallenge: mockIsManagerOfChallenge,
}));

vi.mock('../../../../../../../../packages/database-service/repositories/index.js', () => ({
  ChallengeRepository: class {
    findById = mockFindById;
  },
  ComputeRequestRepository: class {
    findByChallenge = mockFindByChallenge;
  },
  UserRepository: class {
    findByIds = mockFindByIds;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function getRequests() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-requests`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'admin' });
  mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });
  mockFindByChallenge.mockResolvedValue([]);
  mockFindByIds.mockResolvedValue([]);
});

describe('GET /api/challenges/[id]/compute-requests', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await getRequests();

    expect(res.status).toBe(401);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await getRequests();

    expect(res.status).toBe(403);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('allows a manager (non-admin) who manages the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await getRequests();

    expect(res.status).toBe(200);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith(USER_ID, CHALLENGE_ID);
  });

  it('returns 404 when the challenge does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getRequests();

    expect(res.status).toBe(404);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 400 when the challenge is not an ML challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code' });

    const res = await getRequests();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Not an ML challenge' });
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('lists the requests, resolving requester names and never leaking the access token', async () => {
    mockFindByChallenge.mockResolvedValue([
      {
        uuid: 'req-1',
        user_id: 'user-a',
        status: 'ready',
        requested_at: '2026-01-01T00:00:00.000Z',
        decided_at: '2026-01-01T01:00:00.000Z',
        approved_at: '2026-01-01T01:00:00.000Z',
        expires_at: '2026-01-02T01:00:00.000Z',
        error_message: null,
        access_token_enc: 'should-not-leak',
      },
      {
        uuid: 'req-2',
        user_id: 'user-b',
        status: 'pending',
        requested_at: '2026-01-03T00:00:00.000Z',
        decided_at: null,
        approved_at: null,
        expires_at: null,
        error_message: null,
      },
    ]);
    mockFindByIds.mockResolvedValue([
      { uuid: 'user-a', full_name: 'Ada Lovelace' },
      { uuid: 'user-b', full_name: 'Grace Hopper' },
    ]);

    const res = await getRequests();

    expect(res.status).toBe(200);
    expect(mockFindByIds).toHaveBeenCalledWith(['user-a', 'user-b']);
    const body = await res.json();
    expect(body.requests).toEqual([
      {
        id: 'req-1',
        requesterName: 'Ada Lovelace',
        status: 'ready',
        requested_at: '2026-01-01T00:00:00.000Z',
        decided_at: '2026-01-01T01:00:00.000Z',
        approved_at: '2026-01-01T01:00:00.000Z',
        expires_at: '2026-01-02T01:00:00.000Z',
        error_message: null,
      },
      {
        id: 'req-2',
        requesterName: 'Grace Hopper',
        status: 'pending',
        requested_at: '2026-01-03T00:00:00.000Z',
        decided_at: null,
        approved_at: null,
        expires_at: null,
        error_message: null,
      },
    ]);
    expect(body.requests[0].access_token_enc).toBeUndefined();
  });

  it('falls back to "Unknown" when the requester cannot be resolved', async () => {
    mockFindByChallenge.mockResolvedValue([
      { uuid: 'req-1', user_id: 'ghost-user', status: 'pending', requested_at: null, decided_at: null, approved_at: null, expires_at: null, error_message: null },
    ]);
    mockFindByIds.mockResolvedValue([]);

    const res = await getRequests();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests[0].requesterName).toBe('Unknown');
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getRequests();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch compute requests' });
  });
});
