import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockIsManagerOfChallenge, mockChallengeFindById, mockChallengeUpdate,
  mockChallengeDelete, mockRunCloseHooks, mockRunDeleteHooks,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeUpdate: vi.fn(),
  mockChallengeDelete: vi.fn(),
  mockRunCloseHooks: vi.fn(),
  mockRunDeleteHooks: vi.fn(),
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

vi.mock('../../../../../../../packages/capabilities/challenge-hooks', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runCloseHooks: mockRunCloseHooks,
  runDeleteHooks: mockRunDeleteHooks,
}));

import { PUT, DELETE } from './route';
import { SlugTakenError } from '../../../../../../../packages/database-service/domain/slug';

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
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });
  mockChallengeUpdate.mockImplementation(async (_id: string, data: any) => ({ uuid: CHALLENGE_ID, ...data }));
  mockChallengeDelete.mockResolvedValue(undefined);
  mockRunCloseHooks.mockResolvedValue(undefined);
  mockRunDeleteHooks.mockResolvedValue(undefined);
});

describe('PUT /api/challenges/[id] — validation evidence is no longer purged on archive (challenge-014)', () => {
  // No retention policy has been decided yet (SPEC 4.4) — archiving a
  // validation challenge must not touch ValidationAttemptRepository at all
  // anymore. The route module doesn't even import that repository any more
  // (see the vi.mock factory above, which omits it).
  it('archives a validation challenge successfully without purging any evidence', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'endpoint-validation', status: 'active' });

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuid).toBe(CHALLENGE_ID);
  });
});

describe('PUT /api/challenges/[id] — close hooks', () => {
  // Ce que la clôture libère (les instances de calcul d'un challenge ML, par
  // exemple) appartient aux hooks du flow et des extensions, testés chez eux.
  it('runs the close hooks when a challenge transitions to archived', async () => {
    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    expect(mockRunCloseHooks).toHaveBeenCalledWith(expect.objectContaining({ uuid: CHALLENGE_ID, status: 'archived' }));
  });

  it('does not run them while the challenge stays open', async () => {
    const res = await putStatus('active');

    expect(res.status).toBe(200);
    expect(mockRunCloseHooks).not.toHaveBeenCalled();
  });

  it('does not run them again for a challenge that was already closed', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'completed' });

    await putStatus('archived');

    expect(mockRunCloseHooks).not.toHaveBeenCalled();
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

describe('PUT /api/challenges/[id] — slug', () => {
  beforeEach(() => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });
  });

  it('passes a new slug to the repository, which keeps the old one as a redirect', async () => {
    const res = await putBody({ slug: 'renamed' });

    expect(res.status).toBe(200);
    expect(mockChallengeUpdate).toHaveBeenCalledWith(CHALLENGE_ID, expect.objectContaining({ slug: 'renamed' }));
  });

  it('rejects a slug shaped like an id', async () => {
    const res = await putBody({ slug: '8e53bee5-27d0-483d-9adf-091e5df9f2e8' });

    expect(res.status).toBe(400);
    expect(mockChallengeUpdate).not.toHaveBeenCalled();
  });

  it('answers 409 with a suggestion when the slug is taken', async () => {
    mockChallengeUpdate.mockRejectedValue(new SlugTakenError('renamed', 'renamed-2'));

    const res = await putBody({ slug: 'renamed' });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ field: 'slug', suggestion: 'renamed-2' });
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

  it('deletes as admin, running the delete hooks first', async () => {
    const res = await deleteChallenge();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockRunDeleteHooks).toHaveBeenCalledWith(expect.objectContaining({ uuid: CHALLENGE_ID }));
    expect(mockRunDeleteHooks.mock.invocationCallOrder[0]).toBeLessThan(mockChallengeDelete.mock.invocationCallOrder[0]);
    expect(mockChallengeDelete).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('keeps the challenge when a delete hook fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunDeleteHooks.mockRejectedValue(new Error('instances still running'));

    const res = await deleteChallenge();

    expect(res.status).toBe(500);
    expect(mockChallengeDelete).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('deletes as a manager of the challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await deleteChallenge();

    expect(res.status).toBe(200);
    expect(mockChallengeDelete).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('returns 500 when deletion fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockChallengeDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteChallenge();

    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
