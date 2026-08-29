import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../../../../packages/database-service/repositories';

const userRepo = new UserRepository();

/**
 * Appelé en interne par proxy.ts (Edge runtime, ne peut pas parler à `pg`
 * directement) pour vérifier qu'un userId encore valide au sens du JWT existe
 * toujours en base — couvre les comptes fusionnés (accountMerge.repo.ts
 * supprime le compte Google absorbé) et les suppressions de compte classiques.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const user = await userRepo.findById(userId);
  return NextResponse.json({ valid: !!user });
}
