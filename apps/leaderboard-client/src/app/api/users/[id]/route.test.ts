import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { GET, PATCH, DELETE } from './route';

const USER_ID = 'user-1';

function getUser() {
  const req = new NextRequest(`http://localhost/api/users/${USER_ID}`);
  return GET(req, { params: Promise.resolve({ id: USER_ID }) });
}

function patchUser(body: unknown) {
  const req = new NextRequest(`http://localhost/api/users/${USER_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: USER_ID }) });
}

function deleteUser() {
  const req = new NextRequest(`http://localhost/api/users/${USER_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: USER_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/users/[id]', () => {
  it('returns 404 when the user does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getUser();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('returns the user when found', async () => {
    mockFindById.mockResolvedValue({ uuid: USER_ID, full_name: 'Ada Lovelace', role: 'contributor' });

    const res = await getUser();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uuid: USER_ID, full_name: 'Ada Lovelace', role: 'contributor' });
  });

  it('returns 500 when the repository throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getUser();

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/users/[id]', () => {
  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await patchUser({ role: 123 });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the user role', async () => {
    mockUpdate.mockResolvedValue({ uuid: USER_ID, role: 'admin' });

    const res = await patchUser({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(USER_ID, { role: 'admin' });
    expect(await res.json()).toEqual({ uuid: USER_ID, role: 'admin' });
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await patchUser({ role: 'admin' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/users/[id]', () => {
  it('deletes the user and returns success', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteUser();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(USER_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteUser();

    expect(res.status).toBe(500);
  });
});
