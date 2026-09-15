import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { proxy } from './proxy';

const SECRET = 'test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const CHALLENGE_ID = '22222222-2222-4222-8222-222222222222';
const INTERNAL = 'http://127.0.0.1:3000';

const savedEnv = { INTERNAL_APP_URL: process.env.INTERNAL_APP_URL, PORT: process.env.PORT };

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  delete process.env.INTERNAL_APP_URL;
  delete process.env.PORT;
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.INTERNAL_APP_URL;
});

function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(SECRET));
}

function accessToken(role: string) {
  return sign({ userId: USER_ID, role, typ: 'access' });
}

function getUsers(accessToken: string) {
  return proxy(new NextRequest('http://localhost/api/users', {
    headers: { cookie: `access_token=${accessToken}` },
  }));
}

function call(method: string, path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`http://localhost${path}`, { method, headers }));
}

/** Simule la réponse de /api/auth/check-session, seul fetch interne du chemin testé. */
function stubCheckSession(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('proxy — session token validation', () => {
  // Reproduction de l'audit (docs/temp.md, C1) : la valeur du cookie anonyme
  // sb_anon, recopiée dans access_token, ouvrait GET /api/users.
  it('rejects the anonymous sb_anon token placed in access_token', async () => {
    const fetchMock = stubCheckSession(500, {});

    const res = await getUsers(await sign({ aid: USER_ID }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a refresh token placed in access_token', async () => {
    stubCheckSession(200, { valid: true });

    const res = await getUsers(await sign({ userId: USER_ID, role: 'admin', typ: 'refresh' }));

    expect(res.status).toBe(401);
  });

  it('lets a valid access token through', async () => {
    stubCheckSession(200, { valid: true });

    const res = await getUsers(await accessToken('contributor'));

    expect(res.status).toBe(200);
  });

  it('refuses the session when check-session answers 4xx', async () => {
    stubCheckSession(400, { valid: false });

    const res = await getUsers(await accessToken('contributor'));

    expect(res.status).toBe(401);
  });

  it('still fails open when check-session is down (5xx)', async () => {
    stubCheckSession(503, { error: 'Session check unavailable' });

    const res = await getUsers(await accessToken('contributor'));

    expect(res.status).toBe(200);
  });
});

// docs/temp.md, L5 : le refresh token ne doit jamais partir vers un hôte
// choisi par le client.
describe('proxy — internal fetches', () => {
  it('calls check-session on the fixed internal origin, ignoring X-Forwarded-Host', async () => {
    const fetchMock = stubCheckSession(200, { valid: true });

    await proxy(new NextRequest('http://localhost/api/users', {
      headers: { cookie: `access_token=${await accessToken('contributor')}`, 'x-forwarded-host': 'evil.com' },
    }));

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe(INTERNAL);
    expect(url.pathname).toBe('/api/auth/check-session');
  });

  it('posts the refresh token to the internal origin, ignoring X-Forwarded-Host', async () => {
    const newAccess = await accessToken('contributor');
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/api/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers([['set-cookie', `access_token=${newAccess}; Path=/; HttpOnly`]]),
          json: async () => ({ success: true }),
        };
      }
      return new Response(JSON.stringify({ valid: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await proxy(new NextRequest('http://localhost/api/users', {
      headers: { cookie: 'refresh_token=rt', 'x-forwarded-host': 'evil.com', 'x-forwarded-proto': 'https' },
    }));

    expect(res.status).toBe(200);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(input)).toBe(`${INTERNAL}/api/auth/refresh`);
    expect(init.method).toBe('POST');
  });

  it('uses INTERNAL_APP_URL when set', async () => {
    process.env.INTERNAL_APP_URL = 'http://app.internal:8080';
    const fetchMock = stubCheckSession(200, { valid: true });

    await getUsers(await accessToken('contributor'));

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http:\/\/app\.internal:8080\/api\/auth\/check-session/);
  });
});

// docs/temp.md, L6.
describe('proxy — cross-site writes', () => {
  it('refuses a write whose Origin is another site', async () => {
    const fetchMock = stubCheckSession(200, { valid: true });

    const res = await call('POST', '/api/users', {
      cookie: `access_token=${await accessToken('admin')}`,
      origin: 'https://evil.com',
    });

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a write flagged Sec-Fetch-Site: cross-site', async () => {
    stubCheckSession(200, { valid: true });

    const res = await call('DELETE', '/api/users/x', {
      cookie: `access_token=${await accessToken('admin')}`,
      'sec-fetch-site': 'cross-site',
    });

    expect(res.status).toBe(403);
  });

  it('refuses Origin: null', async () => {
    const res = await call('POST', '/api/auth/logout', { origin: 'null' });

    expect(res.status).toBe(403);
  });

  it('covers auth routes too (cross-site logout)', async () => {
    const res = await call('POST', '/api/auth/logout', { origin: 'https://evil.com' });

    expect(res.status).toBe(403);
  });

  it('lets a same-origin write through', async () => {
    stubCheckSession(200, { valid: true });

    const res = await call('POST', '/api/users', {
      cookie: `access_token=${await accessToken('admin')}`,
      origin: 'http://localhost',
      'sec-fetch-site': 'same-origin',
    });

    expect(res.status).toBe(200);
  });

  it('accepts the public host behind the reverse proxy (X-Forwarded-Host)', async () => {
    stubCheckSession(200, { valid: true });

    const res = await call('PATCH', '/api/users/x', {
      cookie: `access_token=${await accessToken('admin')}`,
      host: 'app-internal:8080',
      'x-forwarded-host': 'mytwinlab.care',
      origin: 'https://mytwinlab.care',
    });

    expect(res.status).toBe(200);
  });

  it('lets a write without Origin nor Sec-Fetch-Site through (crons, curl)', async () => {
    stubCheckSession(200, { valid: true });

    const res = await call('POST', '/api/users', { cookie: `access_token=${await accessToken('admin')}` });

    expect(res.status).toBe(200);
  });

  // Le fetch interne de tryRefreshSession n'a ni Origin ni Sec-Fetch-Site.
  it('lets the proxy internal refresh POST through', async () => {
    const res = await call('POST', '/api/auth/refresh', { cookie: 'refresh_token=rt' });

    expect(res.status).toBe(200);
  });

  it('does not affect OAuth callbacks (GET)', async () => {
    const res = await call('GET', '/api/google-auth/callback?code=x&state=y', { 'sec-fetch-site': 'cross-site' });

    expect(res.status).toBe(200);
  });
});

// docs/temp.md §6 : écritures légitimes de non-admins, autorisées dans les handlers.
describe('proxy — non-admin write exceptions', () => {
  it.each([
    // Actions de flow et d'extension : le dispatcher applique l'accès que chacune déclare.
    `/api/challenges/${CHALLENGE_ID}/flow/targets/target-1/claim`,
    `/api/challenges/${CHALLENGE_ID}/ext/compute/request`,
    `/api/challenges/${CHALLENGE_ID}/ext/compute/requests/req-1/decision`,
    '/api/sync-meetings',
  ])('lets a contributor POST %s', async (path) => {
    stubCheckSession(200, { valid: true });

    const res = await call('POST', path, { cookie: `access_token=${await accessToken('contributor')}` });

    expect(res.status).toBe(200);
  });

  it.each([
    ['POST', `/api/challenges/${CHALLENGE_ID}/close`],
    // Sans chemin d'action, ce n'est pas une action : la règle générale s'applique.
    ['DELETE', `/api/challenges/${CHALLENGE_ID}/flow`],
    ['POST', '/api/sync-meetings/meeting-1/analyze'],
    ['DELETE', '/api/sync-meetings'],
  ])('still requires admin for %s %s', async (method, path) => {
    stubCheckSession(200, { valid: true });

    const res = await call(method, path, { cookie: `access_token=${await accessToken('contributor')}` });

    expect(res.status).toBe(403);
  });
});
