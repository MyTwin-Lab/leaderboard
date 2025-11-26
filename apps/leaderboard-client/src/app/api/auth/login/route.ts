import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  getUserByGithubUsername, 
  verifyPassword, 
  generateAccessToken, 
  generateRefreshToken,
  storeRefreshToken 
} from '@/lib/auth';

const loginSchema = z.object({
  github_username: z.string().min(1, 'GitHub username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation du payload
    const validated = loginSchema.parse(body);
    
    // Récupérer l'utilisateur
    const user = await getUserByGithubUsername(validated.github_username);
    
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Vérifier le mot de passe
    const isValidPassword = await verifyPassword(validated.password, user.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Générer les tokens
    const payload = {
      userId: user.uuid,
      github_username: user.github_username,
      role: user.role,
    };
    
    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);
    
    // Stocker le refresh token en base
    await storeRefreshToken(user.uuid, refreshToken);
    
    // Créer la réponse avec les cookies
    const response = NextResponse.json({
      success: true,
      user: {
        uuid: user.uuid,
        github_username: user.github_username,
        full_name: user.full_name,
        role: user.role,
      },
    });
    
    // Définir les cookies HTTP-only
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });
    
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
