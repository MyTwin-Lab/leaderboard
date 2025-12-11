import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();

const createChallengeSchema = z.object({
  title: z.string().min(1),
  status: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
});

// GET /api/challenges - Liste tous les challenges
export async function GET() {
  try {
    const challenges = await challengeRepo.findAll();
    return NextResponse.json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

// POST /api/challenges - Créer un nouveau challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createChallengeSchema.parse(body);
    
    const challenge = await challengeRepo.create({
      ...validated,
      start_date: new Date(validated.start_date),
      end_date: new Date(validated.end_date),
      completion: 0,
    });
    
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}
