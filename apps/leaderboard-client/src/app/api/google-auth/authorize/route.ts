import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { GoogleAuthService } from '../../../../../../../packages/capabilities/identity/google-auth.js';
import { getBaseUrl, safeInternalPath } from '@/lib/url';
import { oauthStateCookieOptions } from '@/lib/sessionCookie';

export async function GET(request: NextRequest) {
  try {
    // Validated even though /signin already sanitises it: this route stays
    // reachable directly, and the value ends up in a post-OAuth redirect.
    const from = safeInternalPath(request.nextUrl.searchParams.get('from'));

    // Nonce lié au navigateur par un cookie : le callback refuse un `code`
    // obtenu ailleurs (CSRF de connexion, docs/temp.md M4). Le nom du cookie
    // est cité dans la politique de confidentialité §9.
    const nonce = randomBytes(16).toString('hex');

    const googleAuthService = new GoogleAuthService();
    const state = JSON.stringify({ nonce, from });
    const authUrl = googleAuthService.getAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('g_oauth_state', nonce, oauthStateCookieOptions());
    return response;
  } catch (error) {
    console.error('[GoogleAuth] Error generating auth URL:', error);
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(new URL('/?error=oauth_init_failed', baseUrl));
  }
}
