import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { declaredQualifications } from '../../../../../../packages/capabilities/qualifications';

export const dynamic = 'force-dynamic';

// GET /api/qualifications — admin only.
// Les qualifications que la distribution installée déclare : ce que l'écran
// des comptes propose d'octroyer. Le rôle est relu en base, comme partout où
// l'on touche aux comptes.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(
    declaredQualifications().map(({ key, label, description }) => ({ key, label, description: description ?? null }))
  );
}
