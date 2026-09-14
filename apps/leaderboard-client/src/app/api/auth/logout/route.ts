import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, invalidateRefreshToken, verifyRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = getTokenFromRequest(request, 'refresh_token');

    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);

      // Révoque la session de cet appareil seulement : le jeton ne peut plus
      // servir à un refresh, même s'il a été copié avant la déconnexion.
      if (payload?.jti) {
        await invalidateRefreshToken(payload.jti);
      }
    }

    // Créer la réponse
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Supprimer les cookies
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
