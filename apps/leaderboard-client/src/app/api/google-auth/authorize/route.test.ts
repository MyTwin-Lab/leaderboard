import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetAuthUrl } = vi.hoisted(() => ({
  mockGetAuthUrl: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/google-workspace/google-auth.service.js', () => ({
  GoogleAuthService: class {
    getAuthUrl = mockGetAuthUrl;
  },
}));

import { GET } from './route';

function getAuthorize(searchParams = '') {
  const req = new NextRequest(`http://localhost/api/google-auth/authorize${searchParams}`, {
    headers: { host: 'localhost:3000' },
  });
  return GET(req);
}

/** Le `state` passé à Google, relu. */
function passedState(): { nonce: string; from: string } {
  return JSON.parse(mockGetAuthUrl.mock.calls[0][0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=1');
});

describe('GET /api/google-auth/authorize', () => {
  it('redirects to the Google auth URL with a default "from" of / when no query param is given', async () => {
    const res = await getAuthorize();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth?mock=1');
    expect(passedState().from).toBe('/');
  });

  // docs/temp.md, M4 : le nonce du state doit être lié au navigateur.
  it('puts a random nonce in the state and in the g_oauth_state cookie', async () => {
    const res = await getAuthorize();

    const { nonce } = passedState();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(res.cookies.get('g_oauth_state')).toMatchObject({
      value: nonce,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  });

  it('propagates a valid internal "from" path into the state', async () => {
    const res = await getAuthorize('?from=/settings/profile');

    expect(res.status).toBe(307);
    expect(passedState().from).toBe('/settings/profile');
  });

  it('falls back to / for an unsafe "from" value (open-redirect protection)', async () => {
    const res = await getAuthorize('?from=' + encodeURIComponent('http://evil.com'));

    expect(res.status).toBe(307);
    expect(passedState().from).toBe('/');
  });

  it('falls back to / for a protocol-relative "from" value', async () => {
    await getAuthorize('?from=' + encodeURIComponent('//1311768467/x'));

    expect(passedState().from).toBe('/');
  });

  it('redirects to /?error=oauth_init_failed when the auth service throws', async () => {
    mockGetAuthUrl.mockImplementation(() => {
      throw new Error('missing credentials');
    });

    const res = await getAuthorize();

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=oauth_init_failed');
  });
});
