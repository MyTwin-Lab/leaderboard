import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  UserQualificationRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { isDeclaredQualification } from '../../../../../../../../packages/capabilities/qualifications';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const userRepo = new UserRepository();
const qualificationRepo = new UserQualificationRepository();

const bodySchema = z.object({
  key: z.string().trim().min(1).max(64),
  // Justification conservée dans qualification_changes (vérification faite, n° d'inscription…).
  note: z.string().trim().max(1000).optional(),
});

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

async function heldKeys(userId: string) {
  return (await qualificationRepo.findByUser(userId)).map(q => q.key);
}

// PUT /api/users/[id]/qualifications — admin only. Octroie une qualification
// déclarée par la distribution ; l'octroi et sa trace s'écrivent dans une seule
// transaction. Octroyer une qualification déjà détenue ne change rien.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const { key, note } = bodySchema.parse(await request.json());
    if (!isDeclaredQualification(key)) {
      return NextResponse.json({ error: `Unknown qualification "${key}"` }, { status: 400 });
    }
    if (!(await userRepo.findById(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const changed = await qualificationRepo.grant(id, key, { changedBy: auth.session.id, note });
    return NextResponse.json({ changed, qualifications: await heldKeys(id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error granting qualification:', error);
    return NextResponse.json({ error: 'Failed to grant qualification' }, { status: 500 });
  }
}

// DELETE /api/users/[id]/qualifications — admin only. Retire une qualification,
// y compris une que la distribution ne déclare plus. Ce qui a déjà été jugé
// sous cette qualification reste compté ; les nouveaux gestes sont refusés.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const { key, note } = bodySchema.parse(await request.json());

    const changed = await qualificationRepo.revoke(id, key, { changedBy: auth.session.id, note });
    return NextResponse.json({ changed, qualifications: await heldKeys(id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error revoking qualification:', error);
    return NextResponse.json({ error: 'Failed to revoke qualification' }, { status: 500 });
  }
}
