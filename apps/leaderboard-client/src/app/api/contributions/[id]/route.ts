import { NextRequest, NextResponse } from 'next/server';
import { ContributionRepository } from '../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const contributionRepo = new ContributionRepository();

// GET /api/contributions/[id] - Une contribution ; son évaluation (grille + score IA)
// n'est renvoyée qu'à son auteur — le reste (titre, reward, date) reste public,
// comme sur les pages de profil.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contribution = await contributionRepo.findById(id);
    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    const payload = await verifyRequestToken(request);
    const isAuthor = payload?.userId === contribution.user_id;

    return NextResponse.json(isAuthor ? contribution : { ...contribution, evaluation: null });
  } catch (error) {
    console.error('Error fetching contribution:', error);
    return NextResponse.json({ error: 'Failed to fetch contribution' }, { status: 500 });
  }
}
