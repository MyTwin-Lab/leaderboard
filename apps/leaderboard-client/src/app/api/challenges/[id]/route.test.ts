import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockIsManagerOfChallenge, mockChallengeFindById, mockChallengeUpdate,
  mockChallengeDelete, mockTerminateForChallenge,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeUpdate: vi.fn(),
  mockChallengeDelete: vi.fn(),
  mockTerminateForChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
    update = mockChallengeUpdate;
    delete = mockChallengeDelete;
  },
  ChallengeTeamRepository: class {
    findByChallenge = vi.fn().mockResolvedValue([]);
    create = vi.fn();
  },
}));

vi.mock('../../../../../../../packages/config/scalewayCredentials', () => ({
  getScalewayCredentials: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../../../../packages/services/compute/compute-request.service.js', () => ({
  ComputeRequestService: class {
    terminateForChallenge = mockTerminateForChallenge;
  },
}));

import { PUT, DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';

function putStatus(status: string) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function putBody(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function deleteChallenge() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockChallengeUpdate.mockImplementation(async (_id: string, data: any) => ({ uuid: CHALLENGE_ID, ...data }));
  mockChallengeDelete.mockResolvedValue(undefined);
  mockTerminateForChallenge.mockResolvedValue(undefined);
});

// Give the fire-and-forget terminateForChallenge() call a tick to run —
// it's deliberately not awaited by the route handler itself.
async function flushMicrotasks() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('PUT /api/challenges/[id] — validation evidence is no longer purged on archive (challenge-014)', () => {
  // No retention policy has been decided yet (SPEC 4.4) — archiving a
  // validation challenge must not touch ValidationAttemptRepository at all
  // anymore. The route module doesn't even import that repository any more
  // (see the vi.mock factory above, which omits it), so if this test ever
  // needed to stub a purge call again, that alone would fail to compile —
  // this test is the regression guard for staying that way.
  it('archives a validation challenge successfully without purging any evidence', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'active' });

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuid).toBe(CHALLENGE_ID);
  });
});

describe('PUT /api/challenges/[id] — cuts active GPU compute requests when an ML challenge closes', () => {
  // ComputeRequestService itself is mocked wholesale here (see the vi.mock
  // factory above, added alongside the DELETE tests) — the route's dynamic
  // import resolves to that mock, not the real service, so these assertions
  // target mockTerminateForChallenge (the service entry point actually
  // reached) rather than the repository-level mocks the real service's own
  // implementation would otherwise call.
  it('terminates active compute requests when an ML challenge transitions to archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    // The dynamic import() of compute-request.service.js (deliberately not
    // awaited by the route handler) can take longer than a single 0ms timer
    // tick to settle, especially as the first thing this worker resolves it
    // — poll instead of a fixed flushMicrotasks() wait, which was flaky here.
    await vi.waitFor(() => expect(mockTerminateForChallenge).toHaveBeenCalledWith(CHALLENGE_ID, 'challenge_closed'));
  });

  it('does not touch compute requests for a non-ML challenge closing', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });

    const res = await putStatus('archived');
    await flushMicrotasks();

    expect(res.status).toBe(200);
    expect(mockTerminateForChallenge).not.toHaveBeenCalled();
  });

  it('still returns 200 even if terminating compute requests fails (best-effort)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });
    mockTerminateForChallenge.mockRejectedValue(new Error('db down'));

    const res = await putStatus('archived');
    await flushMicrotasks();

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/challenges/[id] — reward_rules accepts either an ML or a code shape', () => {
  beforeEach(() => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });
  });

  it('accepts a valid code reward_rules shape', async () => {
    const res = await putBody({ reward_rules: { version: 1, delivery: { fixed: 25, cap: 75 } } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reward_rules).toEqual({ version: 1, delivery: { fixed: 25, cap: 75 } });
  });

  it('rejects reward_rules matching neither the ml nor the code shape', async () => {
    const res = await putBody({ reward_rules: { foo: 1 } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid reward_rules');
    expect(mockChallengeUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/challenges/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await deleteChallenge();

    expect(res.status).toBe(401);
    expect(mockChallengeDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage this challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await deleteChallenge();

    expect(res.status).toBe(403);
    expect(mockChallengeDelete).not.toHaveBeenCalled();
  });

  it('deletes as admin, terminating any active compute request first', async () => {
    const res = await deleteChallenge();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockTerminateForChallenge).toHaveBeenCalledWith(CHALLENGE_ID, 'challenge_deleted');
    expect(mockChallengeDelete).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('deletes as a manager of the challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await deleteChallenge();

    expect(res.status).toBe(200);
    expect(mockChallengeDelete).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 500 when deletion fails', async () => {
    mockChallengeDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteChallenge();

    expect(res.status).toBe(500);
  });
});
