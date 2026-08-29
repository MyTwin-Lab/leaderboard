import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetTokenFromRequest, mockInvalidateAllUserTokens, mockVerifyToken } = vi.hoisted(() => ({
  mockGetTokenFromRequest: vi.fn(),
  mockInvalidateAllUserTokens: vi.fn(),
  mockVerifyToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getTokenFromRequest: mockGetTokenFromRequest,
  invalidateAllUserTokens: mockInvalidateAllUserTokens,
  verifyToken: mockVerifyToken,
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
    expect(mockInvalidateAllUserTokens).not.toHaveBeenCalled();
    expect(res.cookies.get('access_token')?.value).toBe('');
    expect(res.cookies.get('refresh_token')?.value).toBe('');
  });

  it('invalidates all user tokens when the refresh token is valid', async () => {
    mockGetTokenFromRequest.mockReturnValue('refresh-token');
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'a@b.com', role: 'contributor' });

    const res = await postLogout();

    expect(res.status).toBe(200);
    expect(mockVerifyToken).toHaveBeenCalledWith('refresh-token');
    expect(mockInvalidateAllUserTokens).toHaveBeenCalledWith('user-1');
  });

  it('does not invalidate tokens when the refresh token fails verification', async () => {
    mockGetTokenFromRequest.mockReturnValue('bad-token');
    mockVerifyToken.mockResolvedValue(null);

    const res = await postLogout();

    expect(res.status).toBe(200);
    expect(mockInvalidateAllUserTokens).not.toHaveBeenCalled();
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
