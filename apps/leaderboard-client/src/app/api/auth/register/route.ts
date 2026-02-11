import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRepository, OnboardingProgressRepository } from '../../../../../../../packages/database-service/repositories';
import { 
  hashPassword, 
  generateAccessToken, 
  generateRefreshToken,
  storeRefreshToken 
} from '@/lib/auth';

const userRepo = new UserRepository();
const onboardingRepo = new OnboardingProgressRepository();

const registerSchema = z.object({
  github_username: z.string().min(1, 'GitHub username is required').max(39, 'GitHub username too long'),
  full_name: z.string().min(1, 'Full name is required').max(255, 'Full name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Vérifier si le github_username est déjà pris
    const existingUser = await userRepo.findByGithub(validated.github_username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'This GitHub username is already registered' },
        { status: 409 }
      );
    }

    // Créer l'utilisateur avec le rôle contributor
    const passwordHash = await hashPassword(validated.password);
    const user = await userRepo.create({
      github_username: validated.github_username,
      full_name: validated.full_name,
      role: 'contributor',
      password_hash: passwordHash,
    });

    // Auto-login : générer les tokens
    const payload = {
      userId: user.uuid,
      github_username: user.github_username,
      role: user.role,
    };

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    await storeRefreshToken(user.uuid, refreshToken);

    // Init onboarding progress for new user
    await onboardingRepo.initForUser(user.uuid);

    // Réponse avec cookies
    const response = NextResponse.json({
      success: true,
      user: {
        uuid: user.uuid,
        github_username: user.github_username,
        full_name: user.full_name,
        role: user.role,
      },
    }, { status: 201 });

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

    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
