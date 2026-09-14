import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetTokenFromRequest, mockInvalidateRefreshToken, mockVerifyToken } = vi.hoisted(() => ({
  mockGetTokenFromRequest: vi.fn(),
  mockInvalidateRefreshToken: vi.fn(),
  mockVerifyToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getTokenFromRequest: mockGetTokenFromRequest,
  invalidateRefreshToken: mockInvalidateRefreshToken,
  verifyRefreshToken: mockVerifyToken,
}));

import { POST } from './route';

function postLogout() {
  const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/logout', () => {
  it('logs out and clears cookies when there is no refresh token', async () => {
    mockGetTokenFromRequest.mockReturnValue(null);

    const res = await postLogout();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'Logged out successfully' });
    expect(mockVerifyToken).not.toHaveBeenCalled();
    expect(mockInvalidateRefreshToken).not.toHaveBeenCalled();
    expect(res.cookies.get('access_token')?.value).toBe('');
    expect(res.cookies.get('refresh_token')?.value).toBe('');
  });

  it('revokes this refresh token by its jti when it is valid', async () => {
    mockGetTokenFromRequest.mockReturnValue('refresh-token');
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', role: 'contributor', jti: 'jti-1' });

    const res = await postLogout();

    expect(res.status).toBe(200);
    expect(mockVerifyToken).toHaveBeenCalledWith('refresh-token');
    expect(mockInvalidateRefreshToken).toHaveBeenCalledWith('jti-1');
  });

  it('does not revoke anything when the refresh token fails verification', async () => {
    mockGetTokenFromRequest.mockReturnValue('bad-token');
    mockVerifyToken.mockResolvedValue(null);

    const res = await postLogout();

    expect(res.status).toBe(200);
    expect(mockInvalidateRefreshToken).not.toHaveBeenCalled();
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    mockGetTokenFromRequest.mockImplementation(() => {
      throw new Error('cookie parsing exploded');
    });

    const res = await postLogout();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });
});
