import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../../packages/database-service/repositories';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const userRepo = new UserRepository();

const updateUserSchema = z.object({
  github_username: z.string().min(1).optional(),
  full_name: z.string().min(1).optional(),
  role: z.string().optional(),
  password: z.string().min(8).optional(),
});

// GET /api/users/[id] - Récupérer un utilisateur
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await userRepo.findById(id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const { password_hash, ...sanitizedUser } = user;
    return NextResponse.json(sanitizedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Mettre à jour un utilisateur
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateUserSchema.parse(body);
    
    const updateData: any = { ...validated };
    if (validated.password) {
      updateData.password_hash = await hashPassword(validated.password);
      delete updateData.password;
    }
    
    const user = await userRepo.update(id, updateData);
    const { password_hash, ...sanitizedUser } = user;
    
    return NextResponse.json(sanitizedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Supprimer un utilisateur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await userRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
