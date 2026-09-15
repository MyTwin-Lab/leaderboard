import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  credentials: {
    get: vi.fn(),
    status: vi.fn(),
    set: vi.fn(),
    patchMeta: vi.fn(),
    remove: vi.fn(),
  },
  findAllProjects: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: h.getSessionUser }));
vi.mock('../../../../../../packages/capabilities/credentials', () => ({ credentials: h.credentials }));
vi.mock('../../../../../../packages/database-service/repositories', () => ({
  ProjectRepository: class {
    constructor() {
      return { findAll: h.findAllProjects };
    }
  },
}));

import { IntegrationRegistry, type IntegrationDefinition } from '../../../../../../packages/connectors/integrations';
import { GET as listGET } from './route';
import { GET as statusGET } from './[key]/status/route';
import { POST as connectPOST, DELETE as connectDELETE } from './[key]/connection/route';
import { GET as authorizeGET } from './[key]/authorize/route';
import { GET as callbackGET } from './[key]/callback/route';
import { GET as extraGET } from './[key]/extras/[action]/route';

const ADMIN = { id: 'admin-1', role: 'admin' };
const CONTRIBUTOR = { id: 'user-1', role: 'contributor' };

const connect = vi.fn();
const callback = vi.fn();
const disconnect = vi.fn();
const channels = vi.fn();

const kaggleLike: IntegrationDefinition = {
  key: 'kaggle',
  label: 'Kaggle',
  connectionLabel: 'API key connection',
  description: 'Datasets and models.',
  auth: {
    kind: 'api_key',
    fields: [
      { name: 'username', label: 'Username' },
      { name: 'api_key', label: 'API key', secret: true },
      { name: 'zone', label: 'Zone', defaultValue: 'fr-par-2' },
    ],
    connect,
  },
  publicMeta: (meta) => [{ label: 'Username', value: String(meta.username) }],
  disconnect,
  extras: [{ key: 'channels', access: 'admin_or_manager', run: channels }],
};

const githubLike: IntegrationDefinition = {
  key: 'github',
  label: 'GitHub',
  connectionLabel: 'Organization connection',
  description: 'Repositories.',
  auth: {
    kind: 'oauth',
    authorize: ({ state }) => ({ url: `https://github.com/login/oauth/authorize?state=${state}` }),
    callback,
  },
};

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  IntegrationRegistry.clear();
  IntegrationRegistry.register(kaggleLike);
  IntegrationRegistry.register(githubLike);
  h.getSessionUser.mockResolvedValue(ADMIN);
  h.credentials.status.mockResolvedValue({ connected: false, meta: {}, connectedAt: null, connectedBy: null });
  h.credentials.set.mockResolvedValue(undefined);
  h.findAllProjects.mockResolvedValue([]);
});

describe('GET /api/integrations', () => {
  it('refuses a non-admin', async () => {
    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);

    expect((await listGET()).status).toBe(401);
  });

  it('lists the installed integrations with their fields and state, never a secret', async () => {
    h.credentials.status.mockImplementation(async (key: string) => key === 'kaggle'
      ? { connected: true, meta: { username: 'ada' }, connectedAt: new Date('2026-09-01T00:00:00Z'), connectedBy: 'admin-1' }
      : { connected: false, meta: {}, connectedAt: null, connectedBy: null });

    const body = await (await listGET()).json();

    expect(body).toEqual([
      {
        key: 'kaggle', label: 'Kaggle', connectionLabel: 'API key connection', description: 'Datasets and models.',
        auth: { kind: 'api_key', fields: kaggleLike.auth.kind === 'api_key' ? kaggleLike.auth.fields : [] },
        connected: true, connected_at: '2026-09-01T00:00:00.000Z', details: [{ label: 'Username', value: 'ada' }],
      },
      {
        key: 'github', label: 'GitHub', connectionLabel: 'Organization connection', description: 'Repositories.',
        auth: { kind: 'oauth' }, connected: false, connected_at: null, details: [],
      },
    ]);
  });
});

describe('GET /api/integrations/[key]/status', () => {
  beforeEach(() => {
    h.credentials.status.mockResolvedValue({ connected: true, meta: { username: 'ada' }, connectedAt: new Date('2026-09-01T00:00:00Z'), connectedBy: null });
  });

  it('gives a non-admin nothing but `connected`', async () => {
    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);

    const res = await statusGET(new Request('http://localhost'), params({ key: 'kaggle' }));

    expect(await res.json()).toEqual({ connected: true });
  });

  it('gives an admin the date and the details', async () => {
    const res = await statusGET(new Request('http://localhost'), params({ key: 'kaggle' }));

    expect(await res.json()).toEqual({ connected: true, connected_at: '2026-09-01T00:00:00.000Z', details: [{ label: 'Username', value: 'ada' }] });
  });

  it('answers 404 for an unknown integration', async () => {
    expect((await statusGET(new Request('http://localhost'), params({ key: 'nope' }))).status).toBe(404);
  });
});

describe('POST /api/integrations/[key]/connection', () => {
  const post = (body: unknown, key = 'kaggle') =>
    connectPOST(jsonRequest(`http://localhost/api/integrations/${key}/connection`, 'POST', body), params({ key }));

  it('refuses a non-admin', async () => {
    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);

    expect((await post({ username: 'ada', api_key: 'k' })).status).toBe(401);
    expect(connect).not.toHaveBeenCalled();
  });

  it('verifies the trimmed values, defaults included, then stores the secret and meta', async () => {
    connect.mockResolvedValue({ ok: true, secret: 'k', meta: { username: 'ada' } });

    const res = await post({ username: ' ada ', api_key: ' k ' });

    expect(res.status).toBe(200);
    expect(connect).toHaveBeenCalledWith({ username: 'ada', api_key: 'k', zone: 'fr-par-2' });
    expect(h.credentials.set).toHaveBeenCalledWith('kaggle', { secret: 'k', meta: { username: 'ada' }, connectedBy: 'admin-1' });
  });

  it('refuses missing fields and invalid JSON without calling the provider', async () => {
    expect(await (await post({ username: 'ada' })).json()).toEqual({ error: 'api_key is required' });
    expect((await post('not-json')).status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it("relays the provider's refusal with its status", async () => {
    connect.mockResolvedValueOnce({ ok: false, error: 'Invalid Kaggle credentials' });
    const refused = await post({ username: 'ada', api_key: 'bad' });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: 'Invalid Kaggle credentials' });

    connect.mockResolvedValueOnce({ ok: false, error: 'Could not reach Kaggle API', status: 502 });
    expect((await post({ username: 'ada', api_key: 'k' })).status).toBe(502);
    expect(h.credentials.set).not.toHaveBeenCalled();
  });

  it('answers 500 when saving fails, and 400 for an OAuth integration', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    connect.mockResolvedValue({ ok: true, secret: 'k' });
    h.credentials.set.mockRejectedValue(new Error('db down'));

    expect((await post({ username: 'ada', api_key: 'k' })).status).toBe(500);
    expect((await post({}, 'github')).status).toBe(400);
    spy.mockRestore();
  });
});

describe('DELETE /api/integrations/[key]/connection', () => {
  const del = (key: string) => connectDELETE(jsonRequest(`http://localhost/api/integrations/${key}/connection`, 'DELETE'), params({ key }));

  it("uses the integration's own disconnect when it declares one", async () => {
    expect((await del('kaggle')).status).toBe(200);
    expect(disconnect).toHaveBeenCalledWith(h.credentials);
    expect(h.credentials.remove).not.toHaveBeenCalled();
  });

  it('removes the connection otherwise, and refuses a non-admin', async () => {
    expect((await del('github')).status).toBe(200);
    expect(h.credentials.remove).toHaveBeenCalledWith('github');

    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);
    expect((await del('github')).status).toBe(401);
  });
});

describe('GET /api/integrations/[key]/authorize', () => {
  it('redirects to the provider with a state bound to the integration in a cookie', async () => {
    const res = await authorizeGET(new Request('http://localhost'), params({ key: 'github' }));

    expect(res.status).toBe(307);
    const state = new URL(res.headers.get('location')!).searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f]{32}$/);
    expect(res.cookies.get('integration_oauth_state')?.value).toBe(`github:${state}`);
  });

  it('refuses a non-admin and an API-key integration', async () => {
    expect((await authorizeGET(new Request('http://localhost'), params({ key: 'kaggle' }))).status).toBe(400);

    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);
    expect((await authorizeGET(new Request('http://localhost'), params({ key: 'github' }))).status).toBe(401);
  });
});

describe('GET /api/integrations/[key]/callback', () => {
  const back = (opts: { state?: string | null; cookie?: string | null; key?: string } = {}) => {
    const { state = 'abc', cookie = 'github:abc', key = 'github' } = opts;
    const url = new URL(`http://localhost/api/integrations/${key}/callback`);
    url.searchParams.set('code', 'the-code');
    if (state !== null) url.searchParams.set('state', state);
    const req = new NextRequest(url, { headers: cookie !== null ? { cookie: `integration_oauth_state=${cookie}` } : undefined });
    return callbackGET(req, params({ key }));
  };

  it('stores the connection and returns to the integrations tab, clearing the cookie', async () => {
    callback.mockResolvedValue({ ok: true, secret: 'gh-token', meta: { org: 'AOrg' } });

    const res = await back();

    expect(res.headers.get('location')).toMatch(/\/contributors\/me\?tab=integrations$/);
    expect(callback).toHaveBeenCalledWith({ code: 'the-code' });
    expect(h.credentials.set).toHaveBeenCalledWith('github', { secret: 'gh-token', meta: { org: 'AOrg' }, connectedBy: 'admin-1' });
    expect(res.headers.get('set-cookie') ?? '').toContain('integration_oauth_state=');
  });

  it('refuses a missing or mismatched state, including a state issued for another integration', async () => {
    expect((await back({ cookie: null })).headers.get('location')).toContain('github_error=csrf');
    expect((await back({ state: 'other' })).headers.get('location')).toContain('github_error=csrf');
    expect((await back({ cookie: 'kaggle:abc' })).headers.get('location')).toContain('github_error=csrf');
    expect(callback).not.toHaveBeenCalled();
  });

  it('refuses a non-admin before exchanging the code', async () => {
    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);

    expect((await back()).headers.get('location')).toContain('github_error=not_admin');
    expect(callback).not.toHaveBeenCalled();
  });

  it("carries the integration's error code back, and a save failure as save_failed", async () => {
    callback.mockResolvedValueOnce({ ok: false, error: 'no_org_admin' });
    expect((await back()).headers.get('location')).toContain('github_error=no_org_admin');

    callback.mockRejectedValueOnce(new Error('boom'));
    expect((await back()).headers.get('location')).toContain('github_error=exchange_failed');

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    callback.mockResolvedValueOnce({ ok: true, secret: 's' });
    h.credentials.set.mockRejectedValueOnce(new Error('db down'));
    expect((await back()).headers.get('location')).toContain('github_error=save_failed');
    spy.mockRestore();
  });
});

describe('GET /api/integrations/[key]/extras/[action]', () => {
  const run = (action = 'channels') => extraGET(new Request('http://localhost'), params({ key: 'kaggle', action }));

  it('runs the extra for an admin', async () => {
    channels.mockResolvedValue([{ id: 'C1', name: 'general' }]);

    expect(await (await run()).json()).toEqual([{ id: 'C1', name: 'general' }]);
  });

  it('lets a project manager in when the extra allows managers, not a plain contributor', async () => {
    h.getSessionUser.mockResolvedValue(CONTRIBUTOR);
    channels.mockResolvedValue([]);

    expect((await run()).status).toBe(403);
    h.findAllProjects.mockResolvedValue([{ uuid: 'p-1', manager_id: 'user-1' }]);
    expect((await run()).status).toBe(200);
  });

  it('answers 404 for an unknown action, and passes a Response through', async () => {
    expect((await run('nope')).status).toBe(404);

    channels.mockResolvedValue(Response.json({ error: 'Slack is not connected' }, { status: 400 }));
    expect((await run()).status).toBe(400);
  });
});
