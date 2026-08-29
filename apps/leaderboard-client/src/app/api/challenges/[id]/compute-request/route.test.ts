import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockFindByChallengeAndUser, mockRequestCompute } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockRequestCompute: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock('../../../../../../../../packages/database-service/repositories/index.js', () => ({
  ComputeRequestRepository: class {
    findByChallengeAndUser = mockFindByChallengeAndUser;
  },
}));

vi.mock('../../../../../../../../packages/services/compute/compute-request.service.js', () => ({
  ComputeRequestService: class {
    requestCompute = mockRequestCompute;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function getRequest() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-request`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postRequest() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-request`, { method: 'POST' });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
});

describe('GET /api/challenges/[id]/compute-request', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await getRequest();

    expect(res.status).toBe(401);
    expect(mockFindByChallengeAndUser).not.toHaveBeenCalled();
  });

  it('returns null when the user has no compute request on this challenge', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    const res = await getRequest();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ request: null });
  });

  it('returns the client-safe shape of the request, excluding the access token', async () => {
    mockFindByChallengeAndUser.mockResolvedValue({
      uuid: 'req-1',
      status: 'ready',
      requested_at: '2026-01-01T00:00:00.000Z',
      approved_at: '2026-01-02T00:00:00.000Z',
      expires_at: '2026-01-03T00:00:00.000Z',
      ready_at: '2026-01-02T01:00:00.000Z',
      expired_at: null,
      error_message: null,
      access_token_enc: 'should-not-leak',
      access_token_iv: 'should-not-leak',
    });

    const res = await getRequest();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request).toEqual({
      id: 'req-1',
      status: 'ready',
      requested_at: '2026-01-01T00:00:00.000Z',
      approved_at: '2026-01-02T00:00:00.000Z',
      expires_at: '2026-01-03T00:00:00.000Z',
      ready_at: '2026-01-02T01:00:00.000Z',
      expired_at: null,
      error_message: null,
    });
    expect(body.request.access_token_enc).toBeUndefined();
    expect(body.request.access_token_iv).toBeUndefined();
  });
});

describe('POST /api/challenges/[id]/compute-request', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postRequest();

    expect(res.status).toBe(401);
    expect(mockRequestCompute).not.toHaveBeenCalled();
  });

  it('creates the compute request and returns 201', async () => {
    mockRequestCompute.mockResolvedValue({
      request: { uuid: 'req-1', status: 'pending', requested_at: null, approved_at: null, expires_at: null, ready_at: null, expired_at: null, error_message: null },
    });

    const res = await postRequest();

    expect(res.status).toBe(201);
    expect(mockRequestCompute).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID);
    const body = await res.json();
    expect(body.request.id).toBe('req-1');
    expect(body.request.status).toBe('pending');
  });

  it('returns 409 when the user already has an active request', async () => {
    mockRequestCompute.mockResolvedValue({ error: 'already_requested' });

    const res = await postRequest();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_requested' });
  });

  it.each(['not_ml_challenge', 'compute_not_enabled', 'scaleway_not_connected'] as const)(
    'returns 400 for business error "%s"',
    async (error) => {
      mockRequestCompute.mockResolvedValue({ error });

      const res = await postRequest();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    },
  );
});
