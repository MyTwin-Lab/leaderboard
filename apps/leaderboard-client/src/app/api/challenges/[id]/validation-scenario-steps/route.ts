import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioStepsService } from '../../../../../../../../packages/services/challenge/scenario-steps.service';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';

const service = new ScenarioStepsService();

/** La forme que lisent ScenarioStepsEditor et l'écran de walkthrough. */
function toWire(step: { uuid: string; position: number; title: string; instructions: string | null }) {
  return { id: step.uuid, position: step.position, title: step.title, instructions: step.instructions };
}

// GET /api/challenges/[id]/validation-scenario-steps
// N'importe quel contributeur connecté. Le scénario est le protocole, pas un
// secret : contrairement à la sortie attendue d'un cas de référence, rien
// n'est caché au validateur en mode scénario.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const [steps, frozen] = await Promise.all([
      service.listSteps(challengeId),
      service.isFrozen(challengeId),
    ]);

    return NextResponse.json({ steps: steps.map(toWire), frozen });
  } catch (error) {
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error fetching scenario steps:', error);
    return NextResponse.json({ error: 'Failed to fetch scenario steps' }, { status: 500 });
  }
}

const addStepSchema = z.object({
  title: z.string().trim().min(1).max(255),
  instructions: z.string().trim().min(1).nullish(),
});

// POST /api/challenges/[id]/validation-scenario-steps — admin/manager only.
// 409 dès qu'une walkthrough existe : le scénario est gelé.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, instructions } = addStepSchema.parse(await req.json());

    const created = await service.addStep({
      validationChallengeId: challengeId,
      title,
      instructions: instructions ?? null,
    });

    return NextResponse.json(toWire(created), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error adding scenario step:', error);
    return NextResponse.json({ error: 'Failed to add scenario step' }, { status: 500 });
  }
}
