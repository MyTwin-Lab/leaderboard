import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../packages/database-service/repositories';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const userRepo = new UserRepository();

const createUserSchema = z.object({
  github_username: z.string().min(1),
  full_name: z.string().min(1),
  role: z.string(),
  password: z.string().min(8).optional(),
});

// GET /api/users - Liste tous les utilisateurs
export async function GET() {
  try {
    const users = await userRepo.findAll();
    // Ne pas renvoyer les password_hash
    const sanitizedUsers = users.map(({ password_hash, ...user }) => user);
    return NextResponse.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Créer un nouvel utilisateur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createUserSchema.parse(body);
    
    const userData: any = {
      github_username: validated.github_username,
      full_name: validated.full_name,
      role: validated.role,
    };
    
    if (validated.password) {
      userData.password_hash = await hashPassword(validated.password);
    }
    
    const user = await userRepo.create(userData);
    const { password_hash, ...sanitizedUser } = user;
    
    return NextResponse.json(sanitizedUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
