import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  verifyRefreshToken,
  consumeRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth';
import { ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, sessionCookieOptions } from '@/lib/sessionCookie';
import { UserRepository } from '../../../../../../../packages/database-service/repositories';

const userRepo = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const refreshToken = getTokenFromRequest(request, 'refresh_token');

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      );
    }

    // Vérifier le refresh token
    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // La signature ne dit pas si le jeton a été révoqué (logout) ou déjà
    // tourné : seule sa ligne en base le sait. Un jeton inconnu révoque toutes
    // les sessions du compte (détection de réutilisation).
    if (!(await consumeRefreshToken(payload))) {
      return NextResponse.json(
        { error: 'Refresh token revoked' },
        { status: 401 }
      );
    }

    // Le payload signé ne prouve que la possession d'un refresh token valide à
    // l'émission — pas que le compte existe encore (fusionné ou supprimé
    // depuis). Sans ce check, on re-signerait indéfiniment un access_token
    // pour un compte fantôme.
    const user = await userRepo.findById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Account no longer exists' },
        { status: 401 }
      );
    }

    // Générer de nouveaux tokens à partir de l'utilisateur relu en base, pas
    // du payload de l'ancien refresh token — sinon un changement de rôle
    // (ex: promotion admin) ne serait jamais répercuté tant que la session
    // se prolonge par rotation de refresh token au lieu d'un nouveau login.
    const freshPayload = { userId: user.uuid, role: user.role };
    const newAccessToken = await generateAccessToken(freshPayload);
    const newRefreshToken = await generateRefreshToken(freshPayload);

    // L'ancien jeton a été consommé ci-dessus ; les sessions des autres
    // appareils restent intactes.
    await storeRefreshToken(user.uuid, newRefreshToken);

    const response = NextResponse.json({
      success: true,
    });

    // Mêmes options qu'à la connexion (lib/sessionCookie.ts).
    response.cookies.set('access_token', newAccessToken, sessionCookieOptions(ACCESS_TOKEN_MAX_AGE));
    response.cookies.set('refresh_token', newRefreshToken, sessionCookieOptions(REFRESH_TOKEN_MAX_AGE));

    return response;

  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
