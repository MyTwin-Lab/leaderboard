import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockMarkRead, mockDelete } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockMarkRead: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  NotificationRepository: class {
    markRead = mockMarkRead;
    delete = mockDelete;
  },
}));

import { PATCH, DELETE } from './route';

const NOTIF_ID = 'n-1';

function call(fn: typeof PATCH | typeof DELETE, method: string) {
  const req = new NextRequest(`http://localhost/api/notifications/${NOTIF_ID}`, { method });
  return fn(req, { params: Promise.resolve({ id: NOTIF_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockMarkRead.mockResolvedValue(true);
  mockDelete.mockResolvedValue(true);
});

describe('PATCH /api/notifications/[id]', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await call(PATCH, 'PATCH')).status).toBe(401);
  });

  it('passes the caller id so ownership is enforced in the query', async () => {
    await call(PATCH, 'PATCH');
    expect(mockMarkRead).toHaveBeenCalledWith(NOTIF_ID, 'user-1');
  });

  it('404s a row that is missing, already read, or not the caller own', async () => {
    // Indistinct volontairement : un 403 confirmerait l'existence d'une ligne
    // qui ne regarde pas l'appelant.
    mockMarkRead.mockResolvedValue(false);
    expect((await call(PATCH, 'PATCH')).status).toBe(404);
  });
});

describe('DELETE /api/notifications/[id]', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await call(DELETE, 'DELETE')).status).toBe(401);
  });

  it('deletes only the caller own row', async () => {
    const res = await call(DELETE, 'DELETE');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledWith(NOTIF_ID, 'user-1');
  });

  it('404s a row the caller does not own', async () => {
    mockDelete.mockResolvedValue(false);
    expect((await call(DELETE, 'DELETE')).status).toBe(404);
  });
});
