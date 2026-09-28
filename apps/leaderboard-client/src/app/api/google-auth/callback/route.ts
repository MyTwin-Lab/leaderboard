import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/capabilities/identity/google-auth.js';
import { events } from '../../../../../../../packages/capabilities/events.js';
import { UserRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth';
import { getBaseUrl, safeInternalPath } from '@/lib/url';
import { ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, sessionCookieOptions } from '@/lib/sessionCookie';
import { readAnonId } from '@/lib/server/anonVisitor';
import { SandboxService } from '../../../../../../../packages/services/sandbox/index.js';

const userRepo = new UserRepository();

const STATE_COOKIE = 'g_oauth_state';

/** `state` tel que posé par /api/google-auth/authorize, ou `null` s'il est illisible. */
function parseState(raw: string | null): { nonce: string; from: string } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { nonce, from } = parsed as Record<string, unknown>;
    if (typeof nonce !== 'string' || nonce.length === 0) return null;
    return { nonce, from: safeInternalPath(typeof from === 'string' ? from : null) };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  // Le nonce est à usage unique : le cookie disparaît quelle que soit l'issue.
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, baseUrl));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return redirectTo('/?error=missing_code');
    }

    // CSRF de connexion : sans ce contrôle, un attaquant fait consommer à la
    // victime un `code` de son propre compte Google (docs/temp.md, M4).
    const state = parseState(searchParams.get('state'));
    const storedNonce = request.cookies.get(STATE_COOKIE)?.value;
    if (!state || !storedNonce || state.nonce !== storedNonce) {
      return redirectTo('/?error=invalid_state');
    }

    const googleAuthService = new GoogleAuthService();
    const tokens = await googleAuthService.getTokensFromCode(code);

    if (!tokens.access_token) {
      return redirectTo('/?error=no_token');
    }

    const userInfo = await googleAuthService.getUserInfo(tokens.access_token);

    // Login or Register: find existing user by google_user_id
    let user = await userRepo.findByGoogleUserId(userInfo.google_user_id);

    if (!user) {
      // Créer ou lier un compte sur la foi de l'email exige que Google en
      // atteste la propriété.
      if (!userInfo.email_verified) {
        return redirectTo('/?error=email_not_verified');
      }

      // Check if a user with this email already exists (link accounts)
      user = await userRepo.findByEmail(userInfo.email);

      if (user) {
        // Un compte déjà lié à une autre identité Google n'est jamais
        // réattribué : ce serait une prise de contrôle par l'email.
        if (user.google_user_id && user.google_user_id !== userInfo.google_user_id) {
          return redirectTo('/?error=account_conflict');
        }

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

        // Les modules qui attendent un nouveau compte (l'onboarding…) le
        // reçoivent par l'outbox. Hors transaction (la création n'en ouvre
        // pas) : un événement perdu ne doit jamais casser une inscription.
        try {
          await events.emit('user.created', { userId: user.uuid });
        } catch (error) {
          console.warn('[events] user.created not recorded:', error);
        }
      }
    }

    if (!user) {
      return redirectTo('/?error=user_creation_failed');
    }

    // Generate JWT tokens
    const jwtPayload = {
      userId: user.uuid,
      role: user.role,
    };

    const accessToken = await generateAccessToken(jwtPayload);
    const refreshToken = await generateRefreshToken(jwtPayload);
    await storeRefreshToken(user.uuid, refreshToken);

    // Rattachement des stars anonymes (docs/sandbox.md §1.5). Ici et pas
    // ailleurs : le user.uuid est connu, la requête entrante porte encore le
    // cookie `sb_anon`, et les trois chemins ci-dessus (connexion, liaison par
    // email, inscription) convergent sur ce point.
    //
    // Sous try/catch, volontairement : un échec de rattachement ne doit jamais
    // casser une connexion. La transaction laisse tout ou rien, et la connexion
    // suivante rejoue sans effet — le cookie anonyme n'est pas invalidé.
    try {
      const anonId = await readAnonId(request);
      if (anonId) await new SandboxService().attachAnonStars(anonId, user.uuid);
    } catch (error) {
      console.warn('[sandbox] anonymous star attach failed', error);
    }

    // `from` déjà passé par safeInternalPath dans parseState.
    const response = redirectTo(state.from);
    response.cookies.set('access_token', accessToken, sessionCookieOptions(ACCESS_TOKEN_MAX_AGE));
    response.cookies.set('refresh_token', refreshToken, sessionCookieOptions(REFRESH_TOKEN_MAX_AGE));

    return response;
  } catch (error) {
    console.error('[GoogleAuth] Callback error:', error);
    return redirectTo('/?error=callback_failed');
  }
}
