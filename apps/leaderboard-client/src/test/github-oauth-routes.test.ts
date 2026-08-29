import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  verifyAdmin: vi.fn(),
  verifyRequestToken: vi.fn(),
}));

vi.mock('../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    async get() {
      return {
        github_is_connected: true,
        github_org: 'MyTwin-Lab',
        github_connected_at: new Date('2026-07-10T00:00:00Z'),
        github_connected_by: null,
        theme_key: 'default',
        theme_mode: 'dark',
      };
    }
    async clearGithubConnection() {}
  },
}));

vi.mock('../../../../packages/config/index.js', () => ({
  config: {
    githubOAuth: {
      clientId: 'Iv1.test',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/api/github-oauth/callback',
      encryptionKey: null,
    },
    github: { token: null },
  },
}));

import { GET as authorizeGET } from '../app/api/github-oauth/authorize/route';
import { GET as statusGET } from '../app/api/github-oauth/status/route';
import { DELETE as connectionDELETE } from '../app/api/github-oauth/connection/route';
import { verifyAdmin } from '@/lib/auth';

const mockVerifyAdmin = verifyAdmin as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/github-oauth/authorize', () => {
  it('returns 401 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/github-oauth/authorize');
    const res = await authorizeGET(req);
    expect(res.status).toBe(401);
  });

  it('redirects to GitHub when admin', async () => {
    mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
    const req = new NextRequest('http://localhost/api/github-oauth/authorize');
    const res = await authorizeGET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('client_id=Iv1.test');
    expect(res.headers.get('set-cookie')).toContain('gh_oauth_state');
  });
});

describe('GET /api/github-oauth/status', () => {
  it('returns 401 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/github-oauth/status');
    const res = await statusGET(req);
    expect(res.status).toBe(401);
  });

  it('returns connected status without token', async () => {
    mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
    const req = new NextRequest('http://localhost/api/github-oauth/status');
    const res = await statusGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.org).toBe('MyTwin-Lab');
    expect(body.token).toBeUndefined();
  });
});

describe('DELETE /api/github-oauth/connection', () => {
  it('returns 401 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/github-oauth/connection', { method: 'DELETE' });
    const res = await connectionDELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns ok:true when admin', async () => {
    mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
    const req = new NextRequest('http://localhost/api/github-oauth/connection', { method: 'DELETE' });
    const res = await connectionDELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
