import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

const openRunSchema = z.object({ contribution_id: z.string().uuid() });

// POST /api/challenges/[id]/validation-scenario-runs — tout contributeur connecté.
// Idempotent : crée le brouillon, ou renvoie celui laissé en cours avec les
// retours d'étape déjà enregistrés. Aucun rôle requis — seul l'avis médical
// est gardé sur medical_pro, étape par étape.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const { contribution_id } = openRunSchema.parse(await req.json());

    const state = await service.openWalkthrough({
      validationChallengeId: challengeId,
      contributionId: contribution_id,
      validatorUserId: user.id,
    });

    // `WalkthroughState` est déjà la forme du fil : le service la construit pour
    // le client, pas pour la base. `completedAt` est une Date, que NextResponse
    // sérialise en ISO — exactement ce que le client attend.
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error opening scenario walkthrough:', error);
    return NextResponse.json({ error: 'Failed to open the walkthrough' }, { status: 500 });
  }
}
