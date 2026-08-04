import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindAll, mockCreate } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

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
});

describe('GET /api/users', () => {
  it('returns the list of users', async () => {
    const users = [
      { uuid: '1', full_name: 'Ada Lovelace', role: 'contributor' },
      { uuid: '2', full_name: 'Alan Turing', role: 'admin' },
    ];
    mockFindAll.mockResolvedValue(users);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(users);
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
  it('creates a user and returns it with a 201 status', async () => {
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
    expect(mockCreate).toHaveBeenCalledWith(validated);
    expect(await res.json()).toEqual(created);
  });

  it('creates a user without the optional fields', async () => {
    const created = { uuid: '2', full_name: 'Grace Hopper', role: 'admin' };
    mockCreate.mockResolvedValue(created);

    const res = await postUsers({ full_name: 'Grace Hopper', role: 'admin' });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      github_username: undefined,
      full_name: 'Grace Hopper',
      email: undefined,
      role: 'admin',
    });
    expect(await res.json()).toEqual(created);
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
