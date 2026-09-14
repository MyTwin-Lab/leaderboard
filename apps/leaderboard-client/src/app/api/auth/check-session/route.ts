import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../../packages/database-service/repositories';
import { isUuid } from '@/lib/sessionClaims';

const userRepo = new UserRepository();

/**
 * Appelé en interne par proxy.ts (Edge runtime, ne peut pas parler à `pg`
 * directement) pour vérifier qu'un userId encore valide au sens du JWT existe
 * toujours en base — couvre les comptes fusionnés (accountMerge.repo.ts
 * supprime le compte Google absorbé) et les suppressions de compte classiques.
 *
 * Le proxy laisse passer sur 5xx et refuse sur 4xx : un userId malformé doit
 * donc répondre 400, jamais faire planter la requête Postgres en 500.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isUuid(userId)) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  try {
    const user = await userRepo.findById(userId);
    return NextResponse.json({ valid: !!user });
  } catch (error) {
    console.error('check-session error:', error);
    return NextResponse.json({ error: 'Session check unavailable' }, { status: 503 });
  }
}
