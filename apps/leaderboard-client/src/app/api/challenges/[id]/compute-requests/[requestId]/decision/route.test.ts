import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindById, mockDecide, mockRetryProvisioning } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindById: vi.fn(),
  mockDecide: vi.fn(),
  mockRetryProvisioning: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock('@/lib/server/managerAuth', () => ({
  isManagerOfChallenge: mockIsManagerOfChallenge,
}));

vi.mock('../../../../../../../../../../packages/database-service/repositories/index.js', () => ({
  ChallengeRepository: class {
    findById = mockFindById;
  },
}));

vi.mock('../../../../../../../../../../packages/services/compute/compute-request.service.js', () => ({
  ComputeRequestService: class {
    decide = mockDecide;
    retryProvisioning = mockRetryProvisioning;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const REQUEST_ID = 'req-1';
const USER_ID = 'user-1';

function postDecision(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-requests/${REQUEST_ID}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, requestId: REQUEST_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'admin' });
  mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });
});

describe('POST /api/challenges/[id]/compute-requests/[requestId]/decision', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(401);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(403);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it('allows a manager (non-admin) who manages the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: USER_ID, role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockDecide.mockResolvedValue({ status: 'approved' });

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(200);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith(USER_ID, CHALLENGE_ID);
    expect(mockDecide).toHaveBeenCalledWith(REQUEST_ID, USER_ID, 'approve');
  });

  it('returns 404 when the challenge does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(404);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it('returns 400 when the challenge is not an ML challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code' });

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Not an ML challenge' });
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid JSON body', async () => {
    const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/compute-requests/${REQUEST_ID}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, requestId: REQUEST_ID }) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('approves the request', async () => {
    mockDecide.mockResolvedValue({ status: 'approved' });

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(200);
    expect(mockDecide).toHaveBeenCalledWith(REQUEST_ID, USER_ID, 'approve');
    expect(await res.json()).toEqual({ status: 'approved' });
  });

  it('rejects the request', async () => {
    mockDecide.mockResolvedValue({ status: 'rejected' });

    const res = await postDecision({ decision: 'reject' });

    expect(res.status).toBe(200);
    expect(mockDecide).toHaveBeenCalledWith(REQUEST_ID, USER_ID, 'reject');
    expect(await res.json()).toEqual({ status: 'rejected' });
  });

  it('retries provisioning for a "retry" decision', async () => {
    mockRetryProvisioning.mockResolvedValue(undefined);

    const res = await postDecision({ decision: 'retry' });

    expect(res.status).toBe(200);
    expect(mockRetryProvisioning).toHaveBeenCalledWith(REQUEST_ID);
    expect(await res.json()).toEqual({ status: 'provisioning' });
  });

  it('returns 400 for an unknown decision value', async () => {
    const res = await postDecision({ decision: 'cancel' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'decision must be "approve", "reject" or "retry"' });
  });

  it('returns 400 with the service error message when the decision fails', async () => {
    mockDecide.mockRejectedValue(new Error('Cannot decide a request in status "ready"'));

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Cannot decide a request in status "ready"' });
  });

  it('falls back to a default message when the thrown error has none', async () => {
    mockDecide.mockRejectedValue({});

    const res = await postDecision({ decision: 'approve' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Failed to process decision' });
  });
});
