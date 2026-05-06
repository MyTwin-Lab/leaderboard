import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';
import { getBaseUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  try {
    const rawFrom = request.nextUrl.searchParams.get('from') || '/';
    // Strict validation: only allow internal paths (no protocol-relative URLs, no special chars)
    const from = (rawFrom && /^\/[a-zA-Z0-9\-_\/]*$/.test(rawFrom)) ? rawFrom : '/';

    const googleAuthService = new GoogleAuthService();
    const state = JSON.stringify({ from });
    const authUrl = googleAuthService.getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GoogleAuth] Error generating auth URL:', error);
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(new URL('/?error=oauth_init_failed', baseUrl));
  }
}
