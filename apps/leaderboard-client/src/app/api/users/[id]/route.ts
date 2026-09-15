import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../../packages/database-service/repositories';
import { userRoleSchema } from '../../../../../../../packages/database-service/domain/schemas_zod';
import { getSessionUser } from '@/lib/auth';
import { describeForeignKeyViolation } from './foreignKeyViolation';
import { z } from 'zod';

const userRepo = new UserRepository();

const updateUserSchema = z.object({
  // Liste fermée : une faute de frappe ne doit pas créer un rôle que le proxy ne connaît pas.
  role: userRoleSchema,
  // Justification conservée dans role_changes (qualification déclarée, CGU §6).
  note: z.string().trim().max(1000).optional(),
});

// GET — admin only, comme PATCH et DELETE : la row complète expose email et
// google_user_id. Aucune page n'appelle cette route aujourd'hui.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const user = await userRepo.findById(id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PATCH — admin only. No server-side check existed here before challenge-014;
// fixed then because granting the validation trust boundary went through this
// route; it is a qualification now (/api/users/[id]/qualifications). Chaque changement effectif
// est tracé dans role_changes, dans la même transaction que l'UPDATE.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const validated = updateUserSchema.parse(body);
    const updated = await userRepo.updateRole(id, validated.role, {
      changedBy: session.id,
      note: validated.note,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE — admin only, same rationale as PATCH above.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const deleted = await userRepo.delete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    // Lu par son nom plutôt que par instanceof : la classe vit dans le
    // repository, que les tests de route remplacent par un mock.
    if (error instanceof Error && error.name === 'AccountDeletionConflictError') {
      return NextResponse.json(
        { error: error.message, challengeIds: (error as Error & { challengeIds?: string[] }).challengeIds ?? [] },
        { status: 409 }
      );
    }
    const fk = describeForeignKeyViolation(error);
    if (fk) {
      return NextResponse.json(
        { error: `User is still referenced by table ${fk.table ?? '(unknown)'}`, table: fk.table },
        { status: 409 }
      );
    }
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
