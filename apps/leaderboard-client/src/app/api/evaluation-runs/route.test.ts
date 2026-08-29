import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindAll, mockJwtVerify } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  EvaluationRunsRepository: class {
    findAll = mockFindAll;
  },
}));

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

import { GET } from './route';

function getRuns(query = '', withCookie = true) {
  const req = new NextRequest(`http://localhost/api/evaluation-runs${query}`, {
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
});

describe('GET /api/evaluation-runs', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await getRuns('', false);
    expect(res.status).toBe(401);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));
    const res = await getRuns();
    expect(res.status).toBe(401);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns 403 when the session role is not admin', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'u1', role: 'contributor' } });
    const res = await getRuns();
    expect(res.status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns the runs with default pagination', async () => {
    const runs = [{ uuid: 'run-1' }];
    mockFindAll.mockResolvedValue(runs);

    const res = await getRuns();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(runs);
    expect(mockFindAll).toHaveBeenCalledWith({
      challengeId: undefined,
      status: undefined,
      page: 1,
      pageSize: 50,
    });
  });

  it('forwards challengeId, comma-separated status list and pagination from query params', async () => {
    mockFindAll.mockResolvedValue([]);

    await getRuns('?challengeId=challenge-1&status=succeeded,failed&page=2&pageSize=10');

    expect(mockFindAll).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      status: ['succeeded', 'failed'],
      page: 2,
      pageSize: 10,
    });
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));
    const res = await getRuns();
    expect(res.status).toBe(500);
  });
});
