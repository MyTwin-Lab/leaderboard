import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  invalidateAllUserTokens
} from '@/lib/auth';
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
    const payload = await verifyToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
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
    const freshPayload = { userId: user.uuid, email: user.email ?? '', role: user.role };
    const newAccessToken = await generateAccessToken(freshPayload);
    const newRefreshToken = await generateRefreshToken(freshPayload);
    
    // Invalider l'ancien refresh token et stocker le nouveau (rotation)
    await invalidateAllUserTokens(payload.userId);
    await storeRefreshToken(payload.userId, newRefreshToken);
    
    // Créer la réponse
    const response = NextResponse.json({
      success: true,
    });
    
    // Définir les nouveaux cookies
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });
    
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
