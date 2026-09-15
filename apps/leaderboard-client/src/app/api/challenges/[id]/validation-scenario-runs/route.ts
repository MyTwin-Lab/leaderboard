import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';
import {
  ChallengeRepository,
  ContributionRepository,
  UserRepository,
  ScenarioStepRepository,
  ScenarioRunRepository,
  StepFeedbackRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { isValidationFlow } from '@/distribution/mytwin.validation';

export const dynamic = 'force-dynamic';

const service = new ScenarioWalkthroughService();
const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const userRepo = new UserRepository();
const stepRepo = new ScenarioStepRepository();
const runRepo = new ScenarioRunRepository();
const feedbackRepo = new StepFeedbackRepository();

const openRunSchema = z.object({ contribution_id: z.string().uuid() });

// POST /api/challenges/[id]/validation-scenario-runs — tout principal connecté
// à ce niveau ; ScenarioWalkthroughService.openWalkthrough affine ensuite :
// contributor, medical_pro et admin peuvent ouvrir une walkthrough, viewer
// est refusé (ValidatorRoleError, 403).
// Idempotent : crée le brouillon, ou renvoie celui laissé en cours avec les
// retours d'étape déjà enregistrés. L'avis médical, lui, reste gardé sur
// medical_pro, étape par étape.
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

// GET /api/challenges/[id]/validation-scenario-runs — admin/manager only.
//
// Sans quorum ni majorité, ce panneau est le seul contrôle qualité de la v1 :
// il doit donc livrer de quoi construire une vue structurée — par application,
// qui a testé, chaque résultat d'étape, les commentaires, les avis médicaux et
// le retour global — pas un dump JSON.
//
// Réservé à l'admin/manager, contrairement à la liste des cibles que chaque
// contributeur doit lire : ici on expose le retour signé de tous les autres.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (!isValidationFlow(challenge.type)) {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const [steps, runs] = await Promise.all([
      stepRepo.findByChallenge(challengeId),
      runRepo.findByChallenge(challengeId),
    ]);

    const feedbacks = await feedbackRepo.findByRuns(runs.map(r => r.uuid));
    const feedbacksByRun = new Map<string, typeof feedbacks>();
    for (const f of feedbacks) {
      const list = feedbacksByRun.get(f.run_id) ?? [];
      list.push(f);
      feedbacksByRun.set(f.run_id, list);
    }

    const contributionIds = [...new Set(runs.map(r => r.contribution_id))];
    const contributions = await Promise.all(contributionIds.map(id => contributionRepo.findById(id)));
    const contributionById = new Map(
      contributions.filter((c): c is NonNullable<typeof c> => !!c).map(c => [c.uuid, c])
    );

    const userIds = [...new Set([
      ...[...contributionById.values()].map(c => c.user_id),
      ...runs.map(r => r.validator_user_id),
    ])];
    const users = await userRepo.findByIds(userIds);
    const usersById = new Map(users.map(u => [u.uuid, u]));

    // L'ordre du scénario, pas l'ordre d'insertion : le panneau rend une ligne
    // de marques P/F/B, qui doit correspondre aux étapes qu'elle résume.
    const stepOrder = new Map(steps.map((s, i) => [s.uuid, i]));

    return NextResponse.json({
      steps: steps.map(s => ({ id: s.uuid, position: s.position, title: s.title })),
      runs: runs.map(run => {
        const contribution = contributionById.get(run.contribution_id);
        const submitter = contribution ? usersById.get(contribution.user_id) : undefined;
        const validator = usersById.get(run.validator_user_id);
        const runFeedbacks = (feedbacksByRun.get(run.uuid) ?? [])
          .slice()
          .sort((a, b) => (stepOrder.get(a.step_id) ?? 0) - (stepOrder.get(b.step_id) ?? 0));

        return {
          id: run.uuid,
          contributionId: run.contribution_id,
          submitterName: submitter?.full_name ?? 'Unknown',
          endpointUrl: contribution?.live_endpoint_url ?? null,
          validatorId: run.validator_user_id,
          validatorName: validator?.full_name ?? 'Unknown',
          isMedicalPro: validator?.role === 'medical_pro',
          completedAt: run.completed_at,
          globalFeedback: run.global_feedback,
          answeredCount: runFeedbacks.length,
          stepFeedbacks: runFeedbacks.map(f => ({
            stepId: f.step_id,
            result: f.result,
            comment: f.comment,
            medicalComment: f.medical_comment,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching scenario walkthroughs:', error);
    return NextResponse.json({ error: 'Failed to fetch walkthroughs' }, { status: 500 });
  }
}
