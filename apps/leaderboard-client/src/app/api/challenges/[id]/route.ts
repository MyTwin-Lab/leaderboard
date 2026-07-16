import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../packages/database-service/repositories';
import { mlRewardRulesSchema } from '../../../../../../../packages/database-service/domain/mlRewardRules';
import { verifyRequestToken } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();

const updateChallengeSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative().optional(),
  project_id: z.string().uuid().optional(),
  reward_rules: mlRewardRulesSchema.nullish(),
});

// GET /api/challenges/[id] - Récupérer un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenge = await challengeRepo.findById(id);
    
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge' },
      { status: 500 }
    );
  }
}

// PUT /api/challenges/[id] - Mettre à jour un challenge
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const isAdmin = session.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(session.userId, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateChallengeSchema.parse(body);
    
    const updateData: any = { ...validated };
    if (validated.start_date) updateData.start_date = new Date(validated.start_date);
    if (validated.end_date) updateData.end_date = new Date(validated.end_date);
    
    const challenge = await challengeRepo.update(id, updateData);
    return NextResponse.json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error updating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}

// DELETE /api/challenges/[id] - Supprimer un challenge
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await challengeRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    return NextResponse.json(
      { error: 'Failed to delete challenge' },
      { status: 500 }
    );
  }
}
