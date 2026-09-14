import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

// Le corps porte l'état complet du panneau d'étape : un champ commentaire
// absent vaut vide, jamais « garde l'ancienne valeur ». C'est ce contrat qui
// permet un seul upsert côté base, sans lecture préalable.
const saveStepSchema = z.object({
  result: z.enum(['passed', 'failed', 'blocked']),
  comment: z.string().nullish(),
  medical_comment: z.string().nullish(),
});

// PUT /api/challenges/[id]/validation-scenario-runs/[runId]/steps/[stepId]
// Émis à chaque saisie — c'est ce qui rend la navigation entre étapes non
// destructive et la fermeture de l'onglet sans conséquence.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string; stepId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, runId, stepId } = await params;
    const body = saveStepSchema.parse(await req.json());

    const state = await service.saveStepFeedback({
      validationChallengeId: challengeId,
      runId,
      stepId,
      validatorUserId: user.id,
      result: body.result,
      comment: body.comment ?? null,
      medicalComment: body.medical_comment ?? null,
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
    console.error('Error saving scenario step feedback:', error);
    return NextResponse.json({ error: 'Failed to save the step' }, { status: 500 });
  }
}
