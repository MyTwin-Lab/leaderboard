import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { PATCH, DELETE } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockUpdate.mockResolvedValue({ uuid: 'user-1', role: 'medical_pro' });
  mockDelete.mockResolvedValue(undefined);
});

describe('PATCH /api/users/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await patch();
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin session', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    const res = await patch();
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('grants the medical_pro role as an admin — the actual role-grant path this whole feature depends on', async () => {
    const res = await patch({ role: 'medical_pro' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { role: 'medical_pro' });
  });
});

describe('DELETE /api/users/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin session', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    const res = await del();
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes as admin', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('user-1');
  });
});
