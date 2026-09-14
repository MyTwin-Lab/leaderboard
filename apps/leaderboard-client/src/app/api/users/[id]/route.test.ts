import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockUpdateRole, mockDelete } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdateRole: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findById = mockFindById;
    updateRole = mockUpdateRole;
    delete = mockDelete;
  },
}));

import { GET, PATCH, DELETE } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;
const NON_ADMIN_ROLES = ['contributor', 'viewer', 'medical_pro'];

function get() {
  const req = new NextRequest('http://localhost/api/users/user-1');
  return GET(req, { params: Promise.resolve({ id: 'user-1' }) });
}

function patch(body: Record<string, unknown> = { role: 'medical_pro' }) {
  const req = new NextRequest('http://localhost/api/users/user-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: 'user-1' }) });
}

function del() {
  const req = new NextRequest('http://localhost/api/users/user-1', { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: 'user-1' }) });
}

/** Forme d'une erreur pg emballée par drizzle-orm (DrizzleQueryError → cause). */
function drizzleError(code: string, message: string, table?: string) {
  return Object.assign(new Error('Failed query: delete from "users"'), {
    cause: Object.assign(new Error(message), { code, table }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindById.mockResolvedValue({ uuid: 'user-1', role: 'contributor' });
  mockUpdateRole.mockResolvedValue({ uuid: 'user-1', role: 'medical_pro' });
  mockDelete.mockResolvedValue(true);
});

describe('GET /api/users/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it.each(NON_ADMIN_ROLES)('returns 403 for a %s session', async (role) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role });
    const res = await get();
    expect(res.status).toBe(403);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns the user to an admin', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uuid: 'user-1', role: 'contributor' });
  });

  it('returns 404 when the user does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await patch();
    expect(res.status).toBe(401);
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it.each(NON_ADMIN_ROLES)('returns 403 for a %s session', async (role) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role });
    const res = await patch();
    expect(res.status).toBe(403);
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it('grants the medical_pro role as an admin, recording who did it — the actual role-grant path this whole feature depends on', async () => {
    const res = await patch({ role: 'medical_pro', note: 'Kiné, n° RPPS vérifié' });
    expect(res.status).toBe(200);
    expect(mockUpdateRole).toHaveBeenCalledWith('user-1', 'medical_pro', {
      changedBy: 'admin-1',
      note: 'Kiné, n° RPPS vérifié',
    });
  });

  it('rejects a role outside the known list', async () => {
    const res = await patch({ role: 'medical-pro' });
    expect(res.status).toBe(400);
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it('rejects a body without a role', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    mockUpdateRole.mockResolvedValue(null);
    const res = await patch();
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it.each(NON_ADMIN_ROLES)('returns 403 for a %s session', async (role) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role });
    const res = await del();
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes as admin', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('user-1');
  });

  it('returns 404 when the user does not exist', async () => {
    mockDelete.mockResolvedValue(false);
    const res = await del();
    expect(res.status).toBe(404);
  });

  it('translates a foreign-key violation (23503) into a 409 naming the blocking table', async () => {
    mockDelete.mockRejectedValue(
      drizzleError(
        '23503',
        'update or delete on table "users" violates foreign key constraint "some_fk" on table "challenge_documents"',
        'challenge_documents'
      )
    );

    const res = await del();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.table).toBe('challenge_documents');
    expect(body.error).toContain('challenge_documents');
  });

  it('falls back to the pg `table` field when the message has no trailing table', async () => {
    mockDelete.mockRejectedValue(drizzleError('23503', 'foreign key violation', 'sync_meetings'));
    const res = await del();
    expect(res.status).toBe(409);
    expect((await res.json()).table).toBe('sync_meetings');
  });

  it('returns 409 when a group contribution cannot be handed over', async () => {
    const conflict = Object.assign(new Error('Cannot delete this account'), {
      name: 'AccountDeletionConflictError',
      challengeIds: ['challenge-1'],
    });
    mockDelete.mockRejectedValue(conflict);

    const res = await del();

    expect(res.status).toBe(409);
    expect((await res.json()).challengeIds).toEqual(['challenge-1']);
  });

  it('keeps a generic 500 for other database errors', async () => {
    mockDelete.mockRejectedValue(drizzleError('57P01', 'terminating connection'));
    const res = await del();
    expect(res.status).toBe(500);
  });
});
