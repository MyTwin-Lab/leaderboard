import { NextRequest, NextResponse } from 'next/server';
import { 
  getTokenFromRequest, 
  verifyToken, 
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  invalidateAllUserTokens
} from '@/lib/auth';

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
    
    // Générer de nouveaux tokens
    const newAccessToken = await generateAccessToken(payload);
    const newRefreshToken = await generateRefreshToken(payload);
    
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
