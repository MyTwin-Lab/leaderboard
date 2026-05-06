import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const userRepo = new UserRepository();

const createUserSchema = z.object({
  github_username: z.string().min(1).optional(),
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string(),
});

// GET /api/users - Liste tous les utilisateurs
export async function GET() {
  try {
    const users = await userRepo.findAll();
    return NextResponse.json(users);
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
    
    const user = await userRepo.create({
      github_username: validated.github_username,
      full_name: validated.full_name,
      email: validated.email,
      role: validated.role,
    });
    
    return NextResponse.json(user, { status: 201 });
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
