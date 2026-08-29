import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockConfig } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockConfig: {
    githubOAuth: {
      clientId: 'Iv1.test',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/api/github-oauth/callback',
      encryptionKey: null,
    },
  },
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../packages/config/index.js', () => ({
  config: mockConfig,
}));

import { GET } from './route';

function getAuthorize() {
  return GET(new NextRequest('http://localhost/api/github-oauth/authorize'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfig.githubOAuth.clientId = 'Iv1.test';
  mockConfig.githubOAuth.redirectUri = 'http://localhost:3000/api/github-oauth/callback';
});

describe('GET /api/github-oauth/authorize', () => {
  it('returns 401 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await getAuthorize();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Admin only');
  });

  it('returns 500 when GitHub OAuth is not configured', async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
    mockConfig.githubOAuth.clientId = '';
    const res = await getAuthorize();
    expect(res.status).toBe(500);
  });

  it('redirects to GitHub with state cookie when admin', async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });

    const res = await getAuthorize();

    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('https://github.com/login/oauth/authorize');
    expect(location).toContain('client_id=Iv1.test');
    expect(location).toContain('redirect_uri=');
    expect(location).toContain('scope=repo+read%3Aorg');
    expect(location).toMatch(/state=[0-9a-f]{32}/);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('gh_oauth_state=');
    expect(setCookie).toMatch(/HttpOnly/i);
  });
});
