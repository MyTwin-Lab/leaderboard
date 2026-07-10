import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '../../../../../../../packages/config/githubToken.js';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyRequestToken } from '@/lib/auth';
import { config } from '../../../../../../../packages/config/index.js';

const appSettingsRepo = new AppSettingsRepository();
const ERROR_BASE = '/contributors/me';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify CSRF state
  const storedState = request.cookies.get('gh_oauth_state')?.value;
  if (!storedState || state !== storedState) {
    const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=csrf`, request.url));
    res.cookies.delete('gh_oauth_state');
    return res;
  }

  // Exchange code for token
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.githubOAuth.clientId,
        client_secret: config.githubOAuth.clientSecret,
        code,
        redirect_uri: config.githubOAuth.redirectUri,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) throw new Error('no access_token');
    accessToken = tokenData.access_token;
  } catch {
    const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=exchange_failed`, request.url));
    res.cookies.delete('gh_oauth_state');
    return res;
  }

  // Verify org admin/owner membership
  let orgSlug: string;
  try {
    const membershipsRes = await fetch('https://api.github.com/user/memberships/orgs?state=active', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    const memberships = await membershipsRes.json() as Array<{
      state: string;
      role: string;
      organization: { login: string };
    }>;
    const adminOrgs = memberships
      .filter(m => m.state === 'active' && (m.role === 'admin' || m.role === 'owner'))
      .map(m => m.organization.login)
      .sort();
    if (adminOrgs.length === 0) {
      const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=no_org_admin`, request.url));
      res.cookies.delete('gh_oauth_state');
      return res;
    }
    orgSlug = adminOrgs[0];
  } catch {
    const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=exchange_failed`, request.url));
    res.cookies.delete('gh_oauth_state');
    return res;
  }

  // Get current admin user ID from their session token
  const payload = await verifyRequestToken(request);
  const connectedBy = payload?.userId ?? '';

  // Encrypt and persist
  const { enc, iv } = encryptToken(accessToken);
  await appSettingsRepo.updateGithubConnection({
    github_token_enc: enc,
    github_token_iv: iv,
    github_org: orgSlug,
    github_connected_by: connectedBy,
  });

  const res = NextResponse.redirect(new URL(ERROR_BASE, request.url));
  res.cookies.delete('gh_oauth_state');
  return res;
}
