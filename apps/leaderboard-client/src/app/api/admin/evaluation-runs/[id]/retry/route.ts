import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../../../packages/database-service/repositories/index';
import { ChallengeService } from '../../../../../../../../../packages/services/challenge/index';

const runsRepo = new EvaluationRunsRepository();
const challengeService = new ChallengeService();

// POST /api/admin/evaluation-runs/[id]/retry - Relancer un run d'évaluation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    
    // Récupérer le run original
    const originalRun = await runsRepo.findById(runId);
    
    if (!originalRun) {
      return NextResponse.json(
        { error: 'Evaluation run not found' },
        { status: 404 }
      );
    }

    // Vérifier que le run peut être relancé (failed ou succeeded)
    if (originalRun.status === 'running' || originalRun.status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot retry a run that is still in progress' },
        { status: 409 }
      );
    }

    // Parser le body pour les options de relance
    let body: { windowStart?: string; windowEnd?: string; reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body vide ou invalide, on utilise les valeurs par défaut
    }

    // Valider la raison (obligatoire selon la spec)
    if (!body.reason) {
      return NextResponse.json(
        { error: 'Reason is required for retry' },
        { status: 400 }
      );
    }

    // Utiliser les dates du run original ou celles fournies
    const windowStart = body.windowStart 
      ? new Date(body.windowStart) 
      : originalRun.window_start;
    const windowEnd = body.windowEnd 
      ? new Date(body.windowEnd) 
      : originalRun.window_end;

    // Valider les dates
    if (windowStart > windowEnd) {
      return NextResponse.json(
        { error: 'windowStart must be before windowEnd' },
        { status: 400 }
      );
    }

    // Vérifier qu'aucun run n'est déjà en cours pour ce challenge
    const existingRuns = await runsRepo.findAll({
      challengeId: originalRun.challenge_id,
      status: ['running', 'pending'],
    });

    if (existingRuns.length > 0) {
      return NextResponse.json(
        { 
          error: 'A run is already in progress for this challenge',
          existingRunId: existingRuns[0].uuid,
        },
        { status: 409 }
      );
    }

    // Lancer la nouvelle évaluation avec le contexte de retry
    // Note: runSyncEvaluation va créer le nouveau run via RunLogger
    const evaluations = await challengeService.runSyncEvaluation(
      originalRun.challenge_id,
      {
        retryOfRunId: runId,
        triggerType: 'manual',
        windowStart,
        windowEnd,
        retryReason: body.reason,
        // createdBy pourrait venir de la session utilisateur
      }
    );

    return NextResponse.json(
      { 
        success: true,
        message: 'Retry initiated successfully',
        evaluationsCount: evaluations.length,
        originalRunId: runId,
        reason: body.reason,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error retrying evaluation run:', error);
    return NextResponse.json(
      { error: 'Failed to retry evaluation run' },
      { status: 500 }
    );
  }
}
