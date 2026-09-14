import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioStepsService } from '../../../../../../../../../packages/services/challenge/scenario-steps.service';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';

const service = new ScenarioStepsService();

async function authorize(challengeId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
  if (!isAdmin && !isManager) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

// `instructions: null` vide le détail, `instructions` absent le laisse tel
// quel — d'où le .nullish() plutôt qu'un .optional() seul.
const patchStepSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  instructions: z.string().trim().min(1).nullish(),
  position: z.number().int().nonnegative().optional(),
}).refine(
  b => b.title !== undefined || b.instructions !== undefined || b.position !== undefined,
  { message: 'Nothing to update' }
);

// PATCH /api/challenges/[id]/validation-scenario-steps/[stepId] — admin/manager only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: challengeId, stepId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    const patch = patchStepSchema.parse(await req.json());

    const updated = await service.editStep({
      validationChallengeId: challengeId,
      stepId,
      ...patch,
    });

    return NextResponse.json({
      id: updated.uuid, position: updated.position, title: updated.title, instructions: updated.instructions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error updating scenario step:', error);
    return NextResponse.json({ error: 'Failed to update scenario step' }, { status: 500 });
  }
}

// DELETE /api/challenges/[id]/validation-scenario-steps/[stepId] — admin/manager only.
// 409 dès qu'une walkthrough existe : c'est ce refus qui empêche
// validation_step_feedbacks.step_id de pendre dans le vide.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: challengeId, stepId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    await service.removeStep({ validationChallengeId: challengeId, stepId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error deleting scenario step:', error);
    return NextResponse.json({ error: 'Failed to delete scenario step' }, { status: 500 });
  }
}
