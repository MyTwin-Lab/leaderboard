import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, invalidateAllUserTokens, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = getTokenFromRequest(request, 'refresh_token');
    
    if (refreshToken) {
      // Vérifier le token pour obtenir l'userId
      const payload = await verifyToken(refreshToken);
      
      if (payload) {
        // Invalider tous les refresh tokens de l'utilisateur
        await invalidateAllUserTokens(payload.userId);
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
