import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';
import { GoogleAccountRepository } from '../../../../../../../packages/database-service/repositories/googleAccount.repo.js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings/google-account?error=missing_params', request.url));
    }

    const { user_id } = JSON.parse(state);

    const googleAuthService = new GoogleAuthService();
    const tokens = await googleAuthService.getTokensFromCode(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/settings/google-account?error=no_token', request.url));
    }

    const userInfo = await googleAuthService.getUserInfo(tokens.access_token);

    const googleAccountRepo = new GoogleAccountRepository();
    const existing = await googleAccountRepo.findByUserId(user_id);

    if (existing) {
      await googleAccountRepo.update(existing.uuid, {
        google_user_id: userInfo.google_user_id,
        display_name: userInfo.display_name,
        email: userInfo.email,
      });
    } else {
      await googleAccountRepo.create({
        user_id,
        google_user_id: userInfo.google_user_id,
        display_name: userInfo.display_name,
        email: userInfo.email,
      });
    }

    return NextResponse.redirect(new URL('/settings/google-account?success=true', request.url));
  } catch (error) {
    console.error('[GoogleAuth] Callback error:', error);
    return NextResponse.redirect(new URL('/settings/google-account?error=callback_failed', request.url));
  }
}
