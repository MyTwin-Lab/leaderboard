import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetTokenFromRequest, mockVerifyToken, mockGenerateAccessToken, mockGenerateRefreshToken,
  mockStoreRefreshToken, mockInvalidateAllUserTokens, mockFindById,
} = vi.hoisted(() => ({
  mockGetTokenFromRequest: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockGenerateAccessToken: vi.fn(),
  mockGenerateRefreshToken: vi.fn(),
  mockStoreRefreshToken: vi.fn(),
  mockInvalidateAllUserTokens: vi.fn(),
  mockFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getTokenFromRequest: mockGetTokenFromRequest,
  verifyToken: mockVerifyToken,
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  storeRefreshToken: mockStoreRefreshToken,
  invalidateAllUserTokens: mockInvalidateAllUserTokens,
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findById = mockFindById;
  },
}));

import { POST } from './route';

const PAYLOAD = { userId: 'user-1', email: 'a@b.com', role: 'contributor' };

function postRefresh() {
  return POST(new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTokenFromRequest.mockReturnValue('refresh-token');
  mockVerifyToken.mockResolvedValue(PAYLOAD);
  mockGenerateAccessToken.mockResolvedValue('new-access-token');
  mockGenerateRefreshToken.mockResolvedValue('new-refresh-token');
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 without re-signing when the account no longer exists', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await postRefresh();

    expect(res.status).toBe(401);
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    expect(mockInvalidateAllUserTokens).not.toHaveBeenCalled();
  });

  it('rotates the tokens when the account still exists', async () => {
    mockFindById.mockResolvedValue({ uuid: 'user-1', full_name: 'Ada Lovelace' });

    const res = await postRefresh();

    expect(res.status).toBe(200);
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockInvalidateAllUserTokens).toHaveBeenCalledWith('user-1');
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('user-1', 'new-refresh-token');
  });
});
