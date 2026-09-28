import { NextRequest, NextResponse } from 'next/server';
import { UserQualificationRepository, UserRepository } from '../../../../../../packages/database-service/repositories';
import { userRoleSchema } from '../../../../../../packages/database-service/domain/schemas_zod';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';

const userRepo = new UserRepository();
const qualificationRepo = new UserQualificationRepository();

const createUserSchema = z.object({
  github_username: z.string().min(1).optional(),
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  role: userRoleSchema,
});

// Les deux handlers sont réservés aux admins : la liste expose email,
// google_user_id et rôle de chaque compte. getSessionUser() relit le rôle en
// base, un JWT encore valide après une rétrogradation ne suffit donc pas.

// GET /api/users - Liste tous les utilisateurs
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const users = await userRepo.findAll();
    const qualifications = await qualificationRepo.findByUsers(users.map(u => u.uuid));
    const keysByUser = new Map<string, string[]>();
    for (const q of qualifications) keysByUser.set(q.user_id, [...(keysByUser.get(q.user_id) ?? []), q.key]);
    return NextResponse.json(users.map(u => ({ ...u, qualifications: keysByUser.get(u.uuid) ?? [] })));
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
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const validated = createUserSchema.parse(body);

    // Le rôle initial est tracé dans role_changes, dans la transaction de l'INSERT.
    const user = await userRepo.create(
      {
        github_username: validated.github_username,
        full_name: validated.full_name,
        email: validated.email,
        role: validated.role,
      },
      { changedBy: session.id }
    );

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
