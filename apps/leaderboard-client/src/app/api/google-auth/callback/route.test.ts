import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetTokensFromCode, mockGetUserInfo,
  mockFindByGoogleUserId, mockFindByEmail, mockFindById, mockUpdate, mockCreate,
  mockEmit,
  mockGenerateAccessToken, mockGenerateRefreshToken, mockStoreRefreshToken,
} = vi.hoisted(() => ({
  mockGetTokensFromCode: vi.fn(),
  mockGetUserInfo: vi.fn(),
  mockFindByGoogleUserId: vi.fn(),
  mockFindByEmail: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockEmit: vi.fn(),
  mockGenerateAccessToken: vi.fn(),
  mockGenerateRefreshToken: vi.fn(),
  mockStoreRefreshToken: vi.fn(),
}));

vi.mock('../../../../../../../packages/capabilities/identity/google-auth.js', () => ({
  GoogleAuthService: class {
    getTokensFromCode = mockGetTokensFromCode;
    getUserInfo = mockGetUserInfo;
  },
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  UserRepository: class {
    findByGoogleUserId = mockFindByGoogleUserId;
    findByEmail = mockFindByEmail;
    findById = mockFindById;
    update = mockUpdate;
    create = mockCreate;
  },
}));

vi.mock('../../../../../../../packages/capabilities/events.js', () => ({
  events: { emit: mockEmit },
}));

vi.mock('@/lib/auth', () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  storeRefreshToken: mockStoreRefreshToken,
}));

import { GET } from './route';

const NONCE = 'a'.repeat(32);

/**
 * Callback avec un `state` et un cookie `g_oauth_state` cohérents par défaut.
 * `state: null` omet le paramètre, `cookie: null` omet le cookie.
 */
function getCallback(opts: {
  code?: string | null;
  state?: string | null;
  from?: string;
  cookie?: string | null;
} = {}) {
  const { code = 'abc', from = '/', cookie = NONCE } = opts;
  const state = opts.state === undefined ? JSON.stringify({ nonce: NONCE, from }) : opts.state;

  const url = new URL('http://localhost/api/google-auth/callback');
  if (code !== null) url.searchParams.set('code', code);
  if (state !== null) url.searchParams.set('state', state);

  const headers: Record<string, string> = { host: 'localhost:3000' };
  if (cookie !== null) headers.cookie = `g_oauth_state=${cookie}`;
  return GET(new NextRequest(url, { headers }));
}

const USER = { uuid: 'user-1', email: 'ada@example.com', role: 'contributor', full_name: 'Ada Lovelace' };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTokensFromCode.mockResolvedValue({ access_token: 'gtok' });
  mockGetUserInfo.mockResolvedValue({
    google_user_id: 'g-123',
    email: 'ada@example.com',
    display_name: 'Ada Lovelace',
    email_verified: true,
  });
  mockGenerateAccessToken.mockResolvedValue('access-jwt');
  mockGenerateRefreshToken.mockResolvedValue('refresh-jwt');
  mockStoreRefreshToken.mockResolvedValue(undefined);
});

describe('GET /api/google-auth/callback', () => {
  it('redirects to /?error=missing_code when no code is provided', async () => {
    const res = await getCallback({ code: null });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=missing_code');
    expect(mockGetTokensFromCode).not.toHaveBeenCalled();
  });

  describe('state nonce (login CSRF)', () => {
    it.each([
      ['the state is missing', { state: null }],
      ['the cookie is missing', { cookie: null }],
      ['the nonce differs from the cookie', { cookie: 'b'.repeat(32) }],
      ['the state has no nonce', { state: JSON.stringify({ from: '/' }) }],
      ['the state is not JSON', { state: 'not-json' }],
    ])('refuses before any Google or user lookup when %s', async (_label, opts) => {
      const res = await getCallback(opts);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/?error=invalid_state');
      expect(mockGetTokensFromCode).not.toHaveBeenCalled();
      expect(mockFindByGoogleUserId).not.toHaveBeenCalled();
      expect(mockFindByEmail).not.toHaveBeenCalled();
    });

    it('deletes the g_oauth_state cookie once used', async () => {
      mockFindByGoogleUserId.mockResolvedValue(USER);

      const res = await getCallback();

      expect(res.cookies.get('g_oauth_state')?.value).toBe('');
    });

    it('deletes the g_oauth_state cookie on a refused state too', async () => {
      const res = await getCallback({ cookie: 'b'.repeat(32) });

      expect(res.cookies.get('g_oauth_state')?.value).toBe('');
    });
  });

  it('redirects to /?error=no_token when Google does not return an access token', async () => {
    mockGetTokensFromCode.mockResolvedValue({});

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=no_token');
  });

  it('logs in an existing user found by google_user_id and sets lax session cookies without email in the JWT', async () => {
    mockFindByGoogleUserId.mockResolvedValue(USER);

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(mockFindByEmail).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateAccessToken).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'contributor',
    });
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('user-1', 'refresh-jwt');
    expect(res.cookies.get('access_token')).toMatchObject({ value: 'access-jwt', sameSite: 'lax', httpOnly: true });
    expect(res.cookies.get('refresh_token')).toMatchObject({ value: 'refresh-jwt', sameSite: 'lax', httpOnly: true });
  });

  it('links an existing account found by email to the Google identity', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(USER);
    mockFindById.mockResolvedValue(USER);

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', {
      google_user_id: 'g-123',
      email: 'ada@example.com',
    });
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('never overwrites a different google_user_id already linked to the email', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue({ ...USER, google_user_id: 'g-other' });

    const res = await getCallback();

    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=account_conflict');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
  });

  it('refuses to link an account when Google has not verified the email', async () => {
    mockGetUserInfo.mockResolvedValue({
      google_user_id: 'g-123', email: 'ada@example.com', display_name: 'Ada Lovelace', email_verified: false,
    });
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(USER);

    const res = await getCallback();

    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=email_not_verified');
    expect(mockFindByEmail).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
  });

  it('still logs in an account already linked by google_user_id, whatever verified_email says', async () => {
    mockGetUserInfo.mockResolvedValue({
      google_user_id: 'g-123', email: 'ada@example.com', display_name: 'Ada Lovelace', email_verified: false,
    });
    mockFindByGoogleUserId.mockResolvedValue(USER);

    const res = await getCallback();

    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('registers a brand-new user and announces the new account', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue(USER);

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(mockCreate).toHaveBeenCalledWith({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      google_user_id: 'g-123',
      role: 'contributor',
    });
    expect(mockEmit).toHaveBeenCalledWith('user.created', { userId: 'user-1' });
  });

  it('redirects to /?error=user_creation_failed when the linked account cannot be re-fetched', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(USER);
    mockFindById.mockResolvedValue(null);

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=user_creation_failed');
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
  });

  it('redirects to the safe "from" path carried in state on success', async () => {
    mockFindByGoogleUserId.mockResolvedValue(USER);

    const res = await getCallback({ from: '/contributors/me' });

    expect(res.headers.get('location')).toBe('http://localhost:3000/contributors/me');
  });

  it.each(['http://evil.com', '//1311768467', '//1311768467/phish'])(
    'falls back to / when the "from" path in state is unsafe (%s)',
    async (from) => {
      mockFindByGoogleUserId.mockResolvedValue(USER);

      const res = await getCallback({ from });

      expect(res.headers.get('location')).toBe('http://localhost:3000/');
    },
  );

  it('redirects to /?error=callback_failed when the Google service throws', async () => {
    mockGetTokensFromCode.mockRejectedValue(new Error('network error'));

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=callback_failed');
  });
});
