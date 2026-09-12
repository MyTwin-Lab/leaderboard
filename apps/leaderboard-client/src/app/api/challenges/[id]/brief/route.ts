import { NextRequest, NextResponse } from 'next/server';
import { ChallengeDocumentRepository } from '../../../../../../../../packages/database-service/repositories';
import { BRIEF_FILENAME } from '@/lib/challengeBrief';

const docRepo = new ChallengeDocumentRepository();

/**
 * GET /api/challenges/[id]/brief — lecture publique.
 *
 * Route dédiée plutôt qu'une exception sur `documents` : le brief est la page
 * de garde d'un challenge, écrite pour être lue avant de rejoindre, tandis que
 * le reste du tiroir Docs s'adresse à l'équipe. Ouvrir `documents` aux anonymes
 * pour un seul fichier publierait aussi tous les autres.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await docRepo.findByChallengeAndFilename(id, BRIEF_FILENAME);
    return NextResponse.json({ content: doc?.content ?? null });
  } catch (err) {
    console.error('Error fetching brief:', err);
    return NextResponse.json({ error: 'Failed to fetch the brief' }, { status: 500 });
  }
}
