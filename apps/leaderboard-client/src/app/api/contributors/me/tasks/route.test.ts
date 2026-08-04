import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByUser, mockFindById, mockJwtVerify } = vi.hoisted(() => ({
  mockFindByUser: vi.fn(),
  mockFindById: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findByUser = mockFindByUser;
  },
  ChallengeRepository: class {
    findById = mockFindById;
  },
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

import { GET } from './route';

function getTasks(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `access_token=${token}`;
  const req = new NextRequest('http://localhost/api/contributors/me/tasks', { headers });
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1' } });
});

describe('GET /api/contributors/me/tasks', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await getTasks();

    expect(res.status).toBe(401);
    expect(mockFindByUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));

    const res = await getTasks('bad-token');

    expect(res.status).toBe(401);
    expect(mockFindByUser).not.toHaveBeenCalled();
  });

  it('returns tasks enriched with the challenge title', async () => {
    mockFindByUser.mockResolvedValue([{ uuid: 't1', challenge_id: 'c1' }]);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'My Challenge' });

    const res = await getTasks('good-token');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ uuid: 't1', challenge_id: 'c1', challenge_title: 'My Challenge' }]);
    expect(mockFindByUser).toHaveBeenCalledWith('user-1');
  });

  it('falls back to "Unknown Challenge" when the challenge is not found', async () => {
    mockFindByUser.mockResolvedValue([{ uuid: 't1', challenge_id: 'missing' }]);
    mockFindById.mockResolvedValue(null);

    const res = await getTasks('good-token');

    const body = await res.json();
    expect(body[0].challenge_title).toBe('Unknown Challenge');
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByUser.mockRejectedValue(new Error('db down'));

    const res = await getTasks('good-token');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch tasks');
  });
});
