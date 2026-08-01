import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockIsManagerOfChallenge, mockChallengeFindById, mockChallengeUpdate,
  mockPurgeContentForChallenge, mockFindActiveForChallenge, mockUpdateExpired,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeUpdate: vi.fn(),
  mockPurgeContentForChallenge: vi.fn(),
  mockFindActiveForChallenge: vi.fn(),
  mockUpdateExpired: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
    update = mockChallengeUpdate;
  },
  ChallengeTeamRepository: class {
    findByChallenge = vi.fn().mockResolvedValue([]);
    create = vi.fn();
  },
  ValidationAttemptRepository: class {
    purgeContentForChallenge = mockPurgeContentForChallenge;
  },
  ComputeRequestRepository: class {
    findActiveForChallenge = mockFindActiveForChallenge;
    updateExpired = mockUpdateExpired;
  },
}));

vi.mock('../../../../../../../packages/config/scalewayCredentials', () => ({
  getScalewayCredentials: vi.fn().mockResolvedValue(null),
}));

import { PUT } from './route';

const CHALLENGE_ID = 'challenge-1';

function putStatus(status: string) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockChallengeUpdate.mockImplementation(async (_id: string, data: any) => ({ uuid: CHALLENGE_ID, ...data }));
  mockPurgeContentForChallenge.mockResolvedValue(undefined);
  mockFindActiveForChallenge.mockResolvedValue([]);
  mockUpdateExpired.mockResolvedValue(undefined);
});

// Give the fire-and-forget terminateForChallenge() call a tick to run —
// it's deliberately not awaited by the route handler itself.
async function flushMicrotasks() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('PUT /api/challenges/[id] — archive-triggered purge of validation runs', () => {
  it('purges validation attempt blobs when a validation challenge transitions to archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'active' });

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    expect(mockPurgeContentForChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('does not purge when the challenge is already archived (no transition)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'archived' });

    await putStatus('archived');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('does not purge for a non-validation challenge being archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });

    await putStatus('archived');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('does not purge on a status change that is not "archived"', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'draft' });

    await putStatus('active');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('still returns the updated challenge even if the purge itself fails (best-effort)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'active' });
    mockPurgeContentForChallenge.mockRejectedValue(new Error('db down'));

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuid).toBe(CHALLENGE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await putStatus('archived');
    expect(res.status).toBe(401);
    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage this challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    const res = await putStatus('archived');
    expect(res.status).toBe(403);
    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });
});

describe('PUT /api/challenges/[id] — cuts active GPU compute requests when an ML challenge closes', () => {
  it('expires active compute requests when an ML challenge transitions to archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });
    mockFindActiveForChallenge.mockResolvedValue([{ uuid: 'req-1' }, { uuid: 'req-2' }]);

    const res = await putStatus('archived');
    await flushMicrotasks();

    expect(res.status).toBe(200);
    expect(mockFindActiveForChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockUpdateExpired).toHaveBeenCalledWith('req-1', 'challenge_closed');
    expect(mockUpdateExpired).toHaveBeenCalledWith('req-2', 'challenge_closed');
  });

  it('does not touch compute requests for a non-ML challenge closing', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });

    const res = await putStatus('archived');
    await flushMicrotasks();

    expect(res.status).toBe(200);
    expect(mockFindActiveForChallenge).not.toHaveBeenCalled();
  });

  it('still returns 200 even if terminating compute requests fails (best-effort)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });
    mockFindActiveForChallenge.mockRejectedValue(new Error('db down'));

    const res = await putStatus('archived');
    await flushMicrotasks();

    expect(res.status).toBe(200);
  });
});
