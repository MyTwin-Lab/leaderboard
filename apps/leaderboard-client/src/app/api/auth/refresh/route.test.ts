import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetTokenFromRequest, mockVerifyToken, mockConsumeRefreshToken, mockGenerateAccessToken,
  mockGenerateRefreshToken, mockStoreRefreshToken, mockFindById,
} = vi.hoisted(() => ({
  mockGetTokenFromRequest: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockConsumeRefreshToken: vi.fn(),
  mockGenerateAccessToken: vi.fn(),
  mockGenerateRefreshToken: vi.fn(),
  mockStoreRefreshToken: vi.fn(),
  mockFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getTokenFromRequest: mockGetTokenFromRequest,
  verifyRefreshToken: mockVerifyToken,
  consumeRefreshToken: mockConsumeRefreshToken,
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  storeRefreshToken: mockStoreRefreshToken,
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    findById = mockFindById;
  },
}));

import { POST } from './route';

const PAYLOAD = { userId: 'user-1', role: 'contributor', jti: 'jti-1' };

function postRefresh() {
  return POST(new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTokenFromRequest.mockReturnValue('refresh-token');
  mockVerifyToken.mockResolvedValue(PAYLOAD);
  mockConsumeRefreshToken.mockResolvedValue(true);
  mockGenerateAccessToken.mockResolvedValue('new-access-token');
  mockGenerateRefreshToken.mockResolvedValue('new-refresh-token');
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 when the refresh token is invalid (e.g. a legacy token without jti)', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const res = await postRefresh();

    expect(res.status).toBe(401);
    expect(mockConsumeRefreshToken).not.toHaveBeenCalled();
  });

  // docs/temp.md, M5 : un jeton déconnecté ou déjà tourné ne doit plus rien signer.
  it('returns 401 without re-signing when the token is revoked or replayed', async () => {
    mockConsumeRefreshToken.mockResolvedValue(false);

    const res = await postRefresh();

    expect(res.status).toBe(401);
    expect(mockConsumeRefreshToken).toHaveBeenCalledWith(PAYLOAD);
    expect(mockFindById).not.toHaveBeenCalled();
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    expect(mockStoreRefreshToken).not.toHaveBeenCalled();
  });

  it('returns 401 without re-signing when the account no longer exists', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await postRefresh();

    expect(res.status).toBe(401);
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    expect(mockStoreRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates the tokens when the account still exists, with lax session cookies', async () => {
    mockFindById.mockResolvedValue({ uuid: 'user-1', email: 'a@b.com', role: 'contributor', full_name: 'Ada Lovelace' });

    const res = await postRefresh();

    expect(res.status).toBe(200);
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('user-1', 'new-refresh-token');
    expect(res.cookies.get('access_token')).toMatchObject({ value: 'new-access-token', sameSite: 'lax', httpOnly: true });
    expect(res.cookies.get('refresh_token')).toMatchObject({ value: 'new-refresh-token', sameSite: 'lax', httpOnly: true });
  });

  it('does not put the email in the new tokens', async () => {
    mockFindById.mockResolvedValue({ uuid: 'user-1', email: 'a@b.com', role: 'contributor', full_name: 'Ada Lovelace' });

    await postRefresh();

    expect(mockGenerateAccessToken).toHaveBeenCalledWith({ userId: 'user-1', role: 'contributor' });
    expect(mockGenerateRefreshToken).toHaveBeenCalledWith({ userId: 'user-1', role: 'contributor' });
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
