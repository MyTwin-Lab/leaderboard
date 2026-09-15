import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindAll, mockCreate, mockFindByUsers } = vi.hoisted(() => ({
  mockFindByUsers: vi.fn(),
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
  UserQualificationRepository: class {
    findByUsers = mockFindByUsers;
  },
}));

import { GET, POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function postUsers(body: unknown) {
  const req = new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindByUsers.mockResolvedValue([]);
});

describe('GET /api/users', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it.each(['contributor', 'viewer'])('returns 403 for a %s session', async (role) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns the list of users to an admin, with the qualifications each one holds', async () => {
    const users = [
      { uuid: '1', full_name: 'Ada Lovelace', role: 'contributor' },
      { uuid: '2', full_name: 'Alan Turing', role: 'admin' },
    ];
    mockFindAll.mockResolvedValue(users);
    mockFindByUsers.mockResolvedValue([{ user_id: '1', key: 'medical_pro' }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { ...users[0], qualifications: ['medical_pro'] },
      { ...users[1], qualifications: [] },
    ]);
    expect(mockFindByUsers).toHaveBeenCalledWith(['1', '2']);
    expect(mockFindAll).toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch users' });
  });
});

describe('POST /api/users', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postUsers({ full_name: 'Ada', role: 'contributor' });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each(['contributor', 'viewer'])('returns 403 for a %s session', async (role) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role });

    const res = await postUsers({ full_name: 'Ada', role: 'contributor' });

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a user, audits the initial role, and returns it with a 201 status', async () => {
    const validated = {
      github_username: 'ada',
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'contributor',
    };
    const created = { uuid: '1', ...validated };
    mockCreate.mockResolvedValue(created);

    const res = await postUsers(validated);

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(validated, { changedBy: 'admin-1' });
    expect(await res.json()).toEqual(created);
  });

  it('creates a user without the optional fields', async () => {
    const created = { uuid: '2', full_name: 'Grace Hopper', role: 'admin' };
    mockCreate.mockResolvedValue(created);

    const res = await postUsers({ full_name: 'Grace Hopper', role: 'admin' });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      {
        github_username: undefined,
        full_name: 'Grace Hopper',
        email: undefined,
        role: 'admin',
      },
      { changedBy: 'admin-1' }
    );
    expect(await res.json()).toEqual(created);
  });

  it('rejects a role outside the known list', async () => {
    const res = await postUsers({ full_name: 'Ada', role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod) and does not call the repository', async () => {
    const res = await postUsers({ full_name: '' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation error');
    expect(body.details).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when email is not a valid email', async () => {
    const res = await postUsers({ full_name: 'Ada', role: 'contributor', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postUsers({ full_name: 'Ada Lovelace', role: 'contributor' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create user' });
  });
});
