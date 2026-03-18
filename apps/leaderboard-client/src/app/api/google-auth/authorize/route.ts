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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    return NextResponse.redirect(new URL('/?error=oauth_init_failed', baseUrl));
  }
}
