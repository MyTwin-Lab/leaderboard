import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository, EvaluationRunContributionsRepository } from '../../../../../../../../packages/database-service/repositories/index';

const runsRepo = new EvaluationRunsRepository();
const runContributionsRepo = new EvaluationRunContributionsRepository();

// GET /api/admin/evaluation-runs/[id] - Détail d'un run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Récupérer le run avec le challenge associé
    const result = await runsRepo.findWithChallenge(id);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Evaluation run not found' },
        { status: 404 }
      );
    }

    // Récupérer les stats des contributions
    const contributionCounts = await runContributionsRepo.countByStatus(id);
    const totalContributions = (Object.values(contributionCounts) as number[]).reduce((a, b) => a + b, 0);

    // Calculer la durée si le run est terminé
    let durationMs: number | null = null;
    if (result.run.started_at && result.run.finished_at) {
      durationMs = result.run.finished_at.getTime() - result.run.started_at.getTime();
    }

    return NextResponse.json({
      run: result.run,
      challenge: result.challenge,
      stats: {
        contributionCounts,
        totalContributions,
        durationMs,
      },
    });
  } catch (error) {
    console.error('Error fetching evaluation run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation run' },
      { status: 500 }
    );
  }
}
