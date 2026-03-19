import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';
import { UserRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { OnboardingProgressRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth';
import { getBaseUrl } from '@/lib/url';

const userRepo = new UserRepository();
const onboardingRepo = new OnboardingProgressRepository();

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/?error=missing_code', baseUrl));
    }

    const { from } = stateParam ? JSON.parse(stateParam) : { from: '/' };

    const googleAuthService = new GoogleAuthService();
    const tokens = await googleAuthService.getTokensFromCode(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/?error=no_token', baseUrl));
    }

    const userInfo = await googleAuthService.getUserInfo(tokens.access_token);

    // Login or Register: find existing user by google_user_id
    let user = await userRepo.findByGoogleUserId(userInfo.google_user_id);

    if (!user) {
      // Check if a user with this email already exists (link accounts)
      user = await userRepo.findByEmail(userInfo.email);

      if (user) {
        // Link existing user to this Google account
        await userRepo.update(user.uuid, {
          google_user_id: userInfo.google_user_id,
          email: userInfo.email,
        });
        user = await userRepo.findById(user.uuid);
      } else {
        // Register new user
        user = await userRepo.create({
          full_name: userInfo.display_name,
          email: userInfo.email,
          google_user_id: userInfo.google_user_id,
          role: 'contributor',
        });

        // Init onboarding progress for new user
        await onboardingRepo.initForUser(user.uuid);
      }
    }

    if (!user) {
      return NextResponse.redirect(new URL('/?error=user_creation_failed', baseUrl));
    }

    // Generate JWT tokens
    const jwtPayload = {
      userId: user.uuid,
      email: user.email ?? '',
      role: user.role,
    };

    const accessToken = await generateAccessToken(jwtPayload);
    const refreshToken = await generateRefreshToken(jwtPayload);
    await storeRefreshToken(user.uuid, refreshToken);

    // Redirect with cookies
    const safePath = from?.startsWith('/') ? from : '/';
    const redirectUrl = new URL(safePath, baseUrl);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[GoogleAuth] Callback error:', error);
    return NextResponse.redirect(new URL('/?error=callback_failed', baseUrl));
  }
}
