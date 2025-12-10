import { NextRequest, NextResponse } from 'next/server';
import { ContributionRepository } from '../../../../../../../../packages/database-service/repositories';

const contributionRepo = new ContributionRepository();

// GET /api/contributions/challenge/[id] - Contributions d'un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contributions = await contributionRepo.findByChallenge(id);
    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}
