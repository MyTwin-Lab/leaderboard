import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const challengeRepoRepo = new ChallengeRepoRepository();

const linkRepoSchema = z.object({
  challenge_id: z.string().uuid(),
  repo_id: z.string().uuid(),
});

// POST /api/repos/challenge-repos - Lier un repo à un challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = linkRepoSchema.parse(body);
    
    await challengeRepoRepo.create(validated);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error linking repo to challenge:', error);
    return NextResponse.json(
      { error: 'Failed to link repo to challenge' },
      { status: 500 }
    );
  }
}

// DELETE /api/repos/challenge-repos - Délier un repo d'un challenge
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');
    const repoId = searchParams.get('repo_id');

    if (!challengeId || !repoId) {
      return NextResponse.json(
        { error: 'Missing challenge_id or repo_id' },
        { status: 400 }
      );
    }

    await challengeRepoRepo.delete(challengeId, repoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking repo from challenge:', error);
    return NextResponse.json(
      { error: 'Failed to unlink repo from challenge' },
      { status: 500 }
    );
  }
}
