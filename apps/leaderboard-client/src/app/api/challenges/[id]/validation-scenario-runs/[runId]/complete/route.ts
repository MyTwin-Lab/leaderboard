import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

const completeSchema = z.object({ global_feedback: z.string().trim().min(1) });

// POST /api/challenges/[id]/validation-scenario-runs/[runId]/complete
// Rend la walkthrough immuable et paie cp_per_validation, écrêté au reliquat
// du pool. 400 avec `missingStepIds` s'il reste des étapes sans résultat.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, runId } = await params;
    const { global_feedback } = completeSchema.parse(await req.json());

    const result = await service.completeWalkthrough({
      validationChallengeId: challengeId,
      runId,
      validatorUserId: user.id,
      globalFeedback: global_feedback,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'An overall feedback is required', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error completing scenario walkthrough:', error);
    return NextResponse.json({ error: 'Failed to complete the walkthrough' }, { status: 500 });
  }
}
