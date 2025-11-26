import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../../packages/database-service/repositories';

const challengeRepoRepo = new ChallengeRepoRepository();

// GET /api/repos/[id]/challenges - Récupérer les challenges liés à un repo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenges = await challengeRepoRepo.findChallengesByRepo(id);
    return NextResponse.json(challenges);
  } catch (error) {
    console.error('Error fetching repo challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repo challenges' },
      { status: 500 }
    );
  }
}
