import { NextResponse } from 'next/server';
import { ContributionRepository } from '../../../../../../packages/database-service/repositories';
import type { Contribution } from '../../../../../../packages/database-service/domain/entities';

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

// POST /api/contributions - Crée une contribution manuelle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validation des champs requis
    const { title, type, user_id, challenge_id, reward } = body;
    if (!title || !type || !user_id || !challenge_id || reward === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: title, type, user_id, challenge_id, reward' },
        { status: 400 }
      );
    }

    // Validation du type de contribution
    const validTypes = ['code', 'model', 'dataset', 'docs'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Création de la contribution
    const newContribution = await contributionRepo.create({
      title,
      type,
      description: body.description || undefined,
      evaluation: body.evaluation || {},
      reward: Number(reward),
      user_id,
      challenge_id,
      task_id: body.task_id || undefined,
      submitted_at: new Date(),
    });

    return NextResponse.json(newContribution, { status: 201 });
  } catch (error) {
    console.error('Error creating contribution:', error);
    return NextResponse.json(
      { error: 'Failed to create contribution' },
      { status: 500 }
    );
  }
}
