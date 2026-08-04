import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetTokensFromCode, mockGetUserInfo,
  mockFindByGoogleUserId, mockFindByEmail, mockFindById, mockUpdate, mockCreate,
  mockInitForUser,
  mockGenerateAccessToken, mockGenerateRefreshToken, mockStoreRefreshToken,
} = vi.hoisted(() => ({
  mockGetTokensFromCode: vi.fn(),
  mockGetUserInfo: vi.fn(),
  mockFindByGoogleUserId: vi.fn(),
  mockFindByEmail: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockInitForUser: vi.fn(),
  mockGenerateAccessToken: vi.fn(),
  mockGenerateRefreshToken: vi.fn(),
  mockStoreRefreshToken: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/google-workspace/google-auth.service.js', () => ({
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
  OnboardingProgressRepository: class {
    initForUser = mockInitForUser;
  },
}));

vi.mock('@/lib/auth', () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  storeRefreshToken: mockStoreRefreshToken,
}));

import { GET } from './route';

function getCallback(query: string) {
  const req = new NextRequest(`http://localhost/api/google-auth/callback${query}`, {
    headers: { host: 'localhost:3000' },
  });
  return GET(req);
}

const USER = { uuid: 'user-1', email: 'ada@example.com', role: 'contributor', full_name: 'Ada Lovelace' };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTokensFromCode.mockResolvedValue({ access_token: 'gtok' });
  mockGetUserInfo.mockResolvedValue({
    google_user_id: 'g-123',
    email: 'ada@example.com',
    display_name: 'Ada Lovelace',
  });
  mockGenerateAccessToken.mockResolvedValue('access-jwt');
  mockGenerateRefreshToken.mockResolvedValue('refresh-jwt');
  mockStoreRefreshToken.mockResolvedValue(undefined);
});

describe('GET /api/google-auth/callback', () => {
  it('redirects to /?error=missing_code when no code is provided', async () => {
    const res = await getCallback('');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=missing_code');
    expect(mockGetTokensFromCode).not.toHaveBeenCalled();
  });

  it('redirects to /?error=no_token when Google does not return an access token', async () => {
    mockGetTokensFromCode.mockResolvedValue({});

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=no_token');
  });

  it('logs in an existing user found by google_user_id and sets session cookies', async () => {
    mockFindByGoogleUserId.mockResolvedValue(USER);

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(mockFindByEmail).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateAccessToken).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'ada@example.com',
      role: 'contributor',
    });
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('user-1', 'refresh-jwt');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('access_token=access-jwt');
  });

  it('links an existing account found by email to the Google identity', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(USER);
    mockFindById.mockResolvedValue(USER);

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', {
      google_user_id: 'g-123',
      email: 'ada@example.com',
    });
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockInitForUser).not.toHaveBeenCalled();
  });

  it('registers a brand-new user and initializes onboarding progress', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue(USER);

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(mockCreate).toHaveBeenCalledWith({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      google_user_id: 'g-123',
      role: 'contributor',
    });
    expect(mockInitForUser).toHaveBeenCalledWith('user-1');
  });

  it('redirects to /?error=user_creation_failed when the linked account cannot be re-fetched', async () => {
    mockFindByGoogleUserId.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(USER);
    mockFindById.mockResolvedValue(null);

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=user_creation_failed');
    expect(mockGenerateAccessToken).not.toHaveBeenCalled();
  });

  it('redirects to the safe "from" path carried in state on success', async () => {
    mockFindByGoogleUserId.mockResolvedValue(USER);
    const state = encodeURIComponent(JSON.stringify({ from: '/contributors/me' }));

    const res = await getCallback(`?code=abc&state=${state}`);

    expect(res.headers.get('location')).toBe('http://localhost:3000/contributors/me');
  });

  it('falls back to / when the "from" path in state is unsafe', async () => {
    mockFindByGoogleUserId.mockResolvedValue(USER);
    const state = encodeURIComponent(JSON.stringify({ from: 'http://evil.com' }));

    const res = await getCallback(`?code=abc&state=${state}`);

    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to /?error=callback_failed on malformed state JSON', async () => {
    const res = await getCallback('?code=abc&state=not-json');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=callback_failed');
  });

  it('redirects to /?error=callback_failed when the Google service throws', async () => {
    mockGetTokensFromCode.mockRejectedValue(new Error('network error'));

    const res = await getCallback('?code=abc');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=callback_failed');
  });
});
