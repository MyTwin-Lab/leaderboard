import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockEncryptToken, mockUpdateGithubConnection, mockVerifyRequestToken, mockFetch,
} = vi.hoisted(() => ({
  mockEncryptToken: vi.fn(),
  mockUpdateGithubConnection: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('../../../../../../../packages/config/githubToken.js', () => ({
  encryptToken: mockEncryptToken,
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    updateGithubConnection = mockUpdateGithubConnection;
  },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../packages/config/index.js', () => ({
  config: {
    githubOAuth: {
      clientId: 'Iv1.test',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/api/github-oauth/callback',
      encryptionKey: null,
    },
  },
}));

vi.stubGlobal('fetch', mockFetch);

import { GET } from './route';

const STATE = 'abc123state';

function getCallback(opts: { code?: string | null; state?: string | null; cookieState?: string | null } = {}) {
  const { code = 'auth-code', state = STATE, cookieState = STATE } = opts;
  const url = new URL('http://localhost/api/github-oauth/callback');
  if (code !== null) url.searchParams.set('code', code);
  if (state !== null) url.searchParams.set('state', state);

  const req = new NextRequest(url, {
    headers: cookieState !== null ? { cookie: `gh_oauth_state=${cookieState}` } : undefined,
  });
  return GET(req);
}

function jsonResponse(body: unknown) {
  return { json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockEncryptToken.mockReturnValue({ enc: 'enc-data', iv: 'iv-data' });
  mockUpdateGithubConnection.mockResolvedValue(undefined);
});

describe('GET /api/github-oauth/callback', () => {
  it('redirects with csrf error when there is no stored state cookie', async () => {
    const res = await getCallback({ cookieState: null });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('github_error=csrf');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redirects with csrf error when the query state does not match the cookie', async () => {
    const res = await getCallback({ state: 'other-state' });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('github_error=csrf');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redirects with exchange_failed when the token exchange request throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const res = await getCallback();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('github_error=exchange_failed');
  });

  it('redirects with exchange_failed when the token response has no access_token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'bad_verification_code' }));
    const res = await getCallback();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('github_error=exchange_failed');
  });

  it('redirects with exchange_failed when the membership request throws', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockRejectedValueOnce(new Error('network down'));
    const res = await getCallback();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('github_error=exchange_failed');
  });

  it('redirects with no_org_admin when the user has no admin/owner org membership', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse([
        { state: 'active', role: 'member', organization: { login: 'SomeOrg' } },
      ]));
    const res = await getCallback();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('github_error=no_org_admin');
    expect(mockUpdateGithubConnection).not.toHaveBeenCalled();
  });

  it('redirects with exchange_failed when persisting the token fails', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse([
        { state: 'active', role: 'admin', organization: { login: 'MyOrg' } },
      ]));
    mockUpdateGithubConnection.mockRejectedValue(new Error('db down'));

    const res = await getCallback();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('github_error=exchange_failed');
  });

  it('persists the connection and redirects to the success URL, picking the first admin org alphabetically', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse([
        { state: 'active', role: 'owner', organization: { login: 'ZOrg' } },
        { state: 'active', role: 'admin', organization: { login: 'AOrg' } },
        { state: 'inactive', role: 'admin', organization: { login: 'NopeOrg' } },
      ]));

    const res = await getCallback();

    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/contributors/me?tab=integrations');
    expect(location).not.toContain('github_error');

    expect(mockEncryptToken).toHaveBeenCalledWith('gh-token');
    expect(mockUpdateGithubConnection).toHaveBeenCalledWith({
      github_token_enc: 'enc-data',
      github_token_iv: 'iv-data',
      github_org: 'AOrg',
      github_connected_by: 'admin-1',
    });
  });

  it('persists an empty connected_by when there is no valid session', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse([
        { state: 'active', role: 'admin', organization: { login: 'AOrg' } },
      ]));

    await getCallback();

    expect(mockUpdateGithubConnection).toHaveBeenCalledWith(
      expect.objectContaining({ github_connected_by: '' })
    );
  });

  it('always deletes the gh_oauth_state cookie on redirect', async () => {
    const res = await getCallback({ cookieState: null });
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('gh_oauth_state=');
  });
});
