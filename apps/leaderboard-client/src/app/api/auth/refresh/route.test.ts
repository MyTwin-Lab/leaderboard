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
    mockFindById.mockResolvedValue({ uuid: 'user-1', email: 'a@b.com', role: 'contributor', full_name: 'Ada Lovelace' });

    const res = await postRefresh();

    expect(res.status).toBe(200);
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockInvalidateAllUserTokens).toHaveBeenCalledWith('user-1');
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('user-1', 'new-refresh-token');
  });

  // Regression test: the old code re-signed the OLD refresh token's payload
  // (PAYLOAD.role = 'contributor' below) instead of the freshly re-read DB
  // role — a role change (e.g. a promotion to admin) would silently never
  // take effect for as long as the session kept renewing itself via refresh
  // instead of a fresh login. See app/api/auth/refresh/route.ts.
  it('re-signs the new tokens with the current DB role, not the stale refresh token role', async () => {
    mockFindById.mockResolvedValue({ uuid: 'user-1', email: 'a@b.com', role: 'admin', full_name: 'Ada Lovelace' });

    await postRefresh();

    expect(mockGenerateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', role: 'admin' })
    );
    expect(mockGenerateAccessToken).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: PAYLOAD.role })
    );
    expect(mockGenerateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', role: 'admin' })
    );
  });
});
