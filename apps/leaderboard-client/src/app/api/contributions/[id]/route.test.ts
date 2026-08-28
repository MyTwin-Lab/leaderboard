import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindById,
  mockUpdate,
  mockDelete,
  mockFindByContribution,
  mockVerifyRequestToken,
  mockGetSessionUser,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockFindByContribution: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
  RewardEntryRepository: class {
    findByContribution = mockFindByContribution;
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
  getSessionUser: mockGetSessionUser,
}));

import { GET, PATCH, DELETE } from './route';

const CONTRIBUTION_ID = 'contribution-1';

function getContribution() {
  const req = new NextRequest(`http://localhost/api/contributions/${CONTRIBUTION_ID}`);
  return GET(req, { params: Promise.resolve({ id: CONTRIBUTION_ID }) });
}

function patchContribution(body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/contributions/${CONTRIBUTION_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: CONTRIBUTION_ID }) });
}

function deleteContribution() {
  const req = new NextRequest(`http://localhost/api/contributions/${CONTRIBUTION_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: CONTRIBUTION_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue(null);
  mockGetSessionUser.mockResolvedValue(null);
  mockFindByContribution.mockResolvedValue([]);
});

describe('GET /api/contributions/[id]', () => {
  it('returns 404 when the contribution does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getContribution();

    expect(res.status).toBe(404);
  });

  it('returns the full contribution (with evaluation) to its author', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toEqual({ score: 90 });
  });

  it('strips the evaluation for a different logged-in user', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u2', role: 'contributor', email: 'b@b.com' });

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toBeNull();
  });

  it('strips the evaluation for an anonymous (unauthenticated) request', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toBeNull();
  });

  it('returns 500 when the repository call throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getContribution();

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/contributions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await patchContribution({ title: 'New title' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin user', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'u1', role: 'contributor' });

    const res = await patchContribution({ title: 'New title' });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the contribution does not exist', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue(null);

    const res = await patchContribution({ title: 'New title' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid contribution type', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 10 });

    const res = await patchContribution({ type: 'not-a-type' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the contribution for an admin', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 10 });
    mockUpdate.mockResolvedValue({ uuid: CONTRIBUTION_ID, title: 'New title', reward: 10 });

    const res = await patchContribution({ title: 'New title' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe('New title');
    expect(mockUpdate).toHaveBeenCalledWith(CONTRIBUTION_ID, { title: 'New title' });
  });

  it('rejects a reward change when the contribution has ledger entries', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 100 });
    mockFindByContribution.mockResolvedValue([{ uuid: 'entry-1', points: 100 }]);

    const res = await patchContribution({ reward: 500 });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows an unchanged reward on a ledger-backed contribution', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 100 });
    mockFindByContribution.mockResolvedValue([{ uuid: 'entry-1', points: 100 }]);
    mockUpdate.mockResolvedValue({ uuid: CONTRIBUTION_ID, title: 'New title', reward: 100 });

    const res = await patchContribution({ title: 'New title', reward: 100 });

    expect(res.status).toBe(200);
  });

  it('allows a reward change on a contribution without ledger entries', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 100 });
    mockFindByContribution.mockResolvedValue([]);
    mockUpdate.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 500 });

    const res = await patchContribution({ reward: 500 });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(CONTRIBUTION_ID, { reward: 500 });
  });
});

describe('DELETE /api/contributions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await deleteContribution();

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin user', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'u1', role: 'contributor' });

    const res = await deleteContribution();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the contribution does not exist', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue(null);

    const res = await deleteContribution();

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the contribution for an admin', async () => {
    mockGetSessionUser.mockResolvedValue({ uuid: 'admin', role: 'admin' });
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, reward: 10 });
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteContribution();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(CONTRIBUTION_ID);
  });
});
