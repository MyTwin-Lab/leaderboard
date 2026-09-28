import { z } from "zod";
import type { Challenge } from "../../../../packages/database-service/domain/entities.js";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import {
  ContributionRepository,
  ScenarioRunRepository,
  ScenarioStepRepository,
  StepFeedbackRepository,
  UserQualificationRepository,
  UserRepository,
} from "../../../../packages/database-service/repositories/index.js";
import { qualificationLabel } from "../../../../packages/capabilities/qualifications.js";
import { ScenarioWalkthroughService } from "../../../../packages/services/challenge/scenario-walkthrough.service.js";
import { journeyAccessOf } from "../index.js";
import { relayScenarioError } from "./errors.js";

/**
 * Actions des walkthroughs d'un parcours. Ouvrir, remplir et clore une
 * walkthrough est ouvert à tout compte connecté au niveau du dispatcher :
 * `ScenarioWalkthroughService` affine (rôles éligibles de la configuration,
 * pas sa propre application, la walkthrough m'appartient et est brouillon,
 * avis expert réservé à la qualification exigée). La liste complète est
 * réservée à l'admin et au manager (`../index.ts`).
 */

const service = new ScenarioWalkthroughService();
const contributionRepo = new ContributionRepository();
const userRepo = new UserRepository();
const stepRepo = new ScenarioStepRepository();
const runRepo = new ScenarioRunRepository();
const feedbackRepo = new StepFeedbackRepository();
const qualificationRepo = new UserQualificationRepository();

/** La qualification des avis experts d'un parcours, et son libellé, ou `null`. */
export function expertQualificationOf(challenge: Challenge): { key: string; label: string } | null {
  const key = journeyAccessOf(challenge).expert_comment_qualification;
  return key ? { key, label: qualificationLabel(key) } : null;
}

const openRunSchema = z.object({ contribution_id: z.string().uuid() });

/**
 * `POST scenario-runs` — idempotent : crée le brouillon, ou renvoie celui
 * laissé en cours avec les retours d'étape déjà enregistrés.
 *
 * `WalkthroughState` est déjà la forme du fil : le service la construit pour
 * le client. `completedAt` est une Date, sérialisée en ISO.
 */
export async function openRun({ challenge, request, user }: ActionContext) {
  try {
    const { contribution_id } = openRunSchema.parse(await request.json());
    return await service.openWalkthrough({
      validationChallengeId: challenge.uuid,
      contributionId: contribution_id,
      validatorUserId: user.id,
    });
  } catch (error) {
    return relayScenarioError(error);
  }
}

/**
 * `GET scenario-runs` — sans quorum ni majorité, ce panneau est le seul
 * contrôle qualité : il livre de quoi construire une vue structurée — par
 * application, qui a testé, chaque résultat d'étape, les commentaires, les
 * avis experts et le retour global.
 */
export async function listRuns({ challenge }: ActionContext) {
  const [steps, runs] = await Promise.all([stepRepo.findByChallenge(challenge.uuid), runRepo.findByChallenge(challenge.uuid)]);

  const feedbacks = await feedbackRepo.findByRuns(runs.map((r) => r.uuid));
  const feedbacksByRun = new Map<string, typeof feedbacks>();
  for (const f of feedbacks) {
    const list = feedbacksByRun.get(f.run_id) ?? [];
    list.push(f);
    feedbacksByRun.set(f.run_id, list);
  }

  const contributionIds = [...new Set(runs.map((r) => r.contribution_id))];
  const contributions = await Promise.all(contributionIds.map((id) => contributionRepo.findById(id)));
  const contributionById = new Map(
    contributions.filter((c): c is NonNullable<typeof c> => !!c).map((c) => [c.uuid, c]),
  );

  const userIds = [...new Set([...[...contributionById.values()].map((c) => c.user_id), ...runs.map((r) => r.validator_user_id)])];
  const users = await userRepo.findByIds(userIds);
  const usersById = new Map(users.map((u) => [u.uuid, u]));

  // L'avis expert d'un parcours est réservé à la qualification que sa
  // configuration exige : le panneau signale qui la détient.
  const expert = expertQualificationOf(challenge);
  const expertIds = new Set(
    expert ? await qualificationRepo.findHolders([...new Set(runs.map((r) => r.validator_user_id))], expert.key) : [],
  );

  // L'ordre du scénario, pas l'ordre d'insertion : le panneau rend une ligne
  // de marques P/F/B, qui doit correspondre aux étapes qu'elle résume.
  const stepOrder = new Map(steps.map((s, i) => [s.uuid, i]));

  return {
    steps: steps.map((s) => ({ id: s.uuid, position: s.position, title: s.title })),
    runs: runs.map((run) => {
      const contribution = contributionById.get(run.contribution_id);
      const submitter = contribution ? usersById.get(contribution.user_id) : undefined;
      const validator = usersById.get(run.validator_user_id);
      const runFeedbacks = (feedbacksByRun.get(run.uuid) ?? [])
        .slice()
        .sort((a, b) => (stepOrder.get(a.step_id) ?? 0) - (stepOrder.get(b.step_id) ?? 0));

      return {
        id: run.uuid,
        contributionId: run.contribution_id,
        submitterName: submitter?.full_name ?? "Unknown",
        endpointUrl: contribution?.live_endpoint_url ?? null,
        validatorId: run.validator_user_id,
        validatorName: validator?.full_name ?? "Unknown",
        isExpert: expertIds.has(run.validator_user_id),
        expertLabel: expert?.label ?? null,
        completedAt: run.completed_at,
        globalFeedback: run.global_feedback,
        answeredCount: runFeedbacks.length,
        stepFeedbacks: runFeedbacks.map((f) => ({
          stepId: f.step_id,
          result: f.result,
          comment: f.comment,
          medicalComment: f.medical_comment,
        })),
      };
    }),
  };
}

// Le corps porte l'état complet du panneau d'étape : un champ commentaire
// absent vaut vide, jamais « garde l'ancienne valeur ». C'est ce contrat qui
// permet un seul upsert côté base, sans lecture préalable.
const saveStepSchema = z.object({
  result: z.enum(["passed", "failed", "blocked"]),
  comment: z.string().nullish(),
  medical_comment: z.string().nullish(),
});

/**
 * `PUT scenario-runs/:runId/steps/:stepId` — émis à chaque saisie : c'est ce
 * qui rend la navigation entre étapes non destructive.
 */
export async function saveStep({ challenge, request, params, user }: ActionContext) {
  try {
    const body = saveStepSchema.parse(await request.json());
    return await service.saveStepFeedback({
      validationChallengeId: challenge.uuid,
      runId: params.runId,
      stepId: params.stepId,
      validatorUserId: user.id,
      result: body.result,
      comment: body.comment ?? null,
      medicalComment: body.medical_comment ?? null,
    });
  } catch (error) {
    return relayScenarioError(error);
  }
}

const completeSchema = z.object({ global_feedback: z.string().trim().min(1) });

/**
 * `POST scenario-runs/:runId/complete` — rend la walkthrough immuable et paie
 * `cp_per_validation`, écrêté au reliquat du pool. 400 avec `missingStepIds`
 * s'il reste des étapes sans résultat.
 */
export async function completeRun({ challenge, request, params, user }: ActionContext) {
  try {
    const { global_feedback } = completeSchema.parse(await request.json());
    return await service.completeWalkthrough({
      validationChallengeId: challenge.uuid,
      runId: params.runId,
      validatorUserId: user.id,
      globalFeedback: global_feedback,
    });
  } catch (error) {
    return relayScenarioError(error, "An overall feedback is required");
  }
}
