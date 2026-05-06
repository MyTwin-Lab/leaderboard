import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../../packages/database-service/repositories';

const challengeRepoRepo = new ChallengeRepoRepository();

// GET /api/challenges/[id]/repos - Liste les repos d'un challenge avec infos du repo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repos = await challengeRepoRepo.findByChallengeWithRepo(id);
    return NextResponse.json(repos);
  } catch (error) {
    console.error('Error fetching challenge repos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge repos' },
      { status: 500 }
    );
  }
}
