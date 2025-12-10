import { NextRequest, NextResponse } from 'next/server';
import { ChallengeTeamRepository } from '../../../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const challengeTeamRepo = new ChallengeTeamRepository();

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
});

// GET /api/challenges/[id]/team - Récupérer l'équipe d'un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const team = await challengeTeamRepo.findTeamMembers(id);
    return NextResponse.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}

// POST /api/challenges/[id]/team - Ajouter un membre à l'équipe
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = addMemberSchema.parse(body);
    
    await challengeTeamRepo.create({
      challenge_id: id,
      user_id: validated.user_id,
    });
    
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}
