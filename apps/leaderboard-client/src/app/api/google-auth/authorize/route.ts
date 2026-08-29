import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';
import { getBaseUrl, safeInternalPath } from '@/lib/url';

export async function GET(request: NextRequest) {
  try {
    // Validated even though /signin already sanitises it: this route stays
    // reachable directly, and the value ends up in a post-OAuth redirect.
    const from = safeInternalPath(request.nextUrl.searchParams.get('from'));

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
