import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findById = mockFindById;
  },
}));

import { GET } from './route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function getCheckSession(userId?: string) {
  const url = userId
    ? `http://localhost/api/auth/check-session?userId=${userId}`
    : 'http://localhost/api/auth/check-session';
  return GET(new NextRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/auth/check-session', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await getCheckSession();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false });
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns valid: true when the account still exists', async () => {
    mockFindById.mockResolvedValue({ uuid: USER_ID, full_name: 'Ada Lovelace' });

    const res = await getCheckSession(USER_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
    expect(mockFindById).toHaveBeenCalledWith(USER_ID);
  });

  it('returns valid: false when the account was merged or deleted', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getCheckSession(USER_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
  });
});
