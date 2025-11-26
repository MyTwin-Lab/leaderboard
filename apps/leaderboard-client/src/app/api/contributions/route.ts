import { NextResponse } from 'next/server';
import { ContributionRepository } from '../../../../../../packages/database-service/repositories';

const contributionRepo = new ContributionRepository();

// GET /api/contributions - Liste toutes les contributions
export async function GET() {
  try {
    const contributions = await contributionRepo.findAll();
    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}
