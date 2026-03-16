import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get('from') || '/';

    const googleAuthService = new GoogleAuthService();
    const state = JSON.stringify({ from });
    const authUrl = googleAuthService.getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GoogleAuth] Error generating auth URL:', error);
    return NextResponse.redirect(new URL('/?error=oauth_init_failed', request.url));
  }
}
