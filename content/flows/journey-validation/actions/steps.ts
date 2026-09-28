import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import { ScenarioStepsService } from "../../../../packages/services/challenge/scenario-steps.service.js";
import { relayScenarioError } from "./errors.js";

/**
 * Actions du scénario d'un parcours : ses étapes, lues par tout validateur et
 * écrites par l'admin ou le manager (accès déclaré dans `../index.ts`). Le
 * scénario se gèle dès la première walkthrough (409, côté service).
 */

const service = new ScenarioStepsService();

/** La forme que lisent ScenarioStepsEditor et l'écran de walkthrough. */
function toWire(step: { uuid: string; position: number; title: string; instructions: string | null }) {
  return { id: step.uuid, position: step.position, title: step.title, instructions: step.instructions };
}

/**
 * `GET scenario-steps` — le scénario est le protocole, pas un secret :
 * contrairement à la sortie attendue d'un cas de référence, rien n'est caché
 * au validateur.
 */
export async function listSteps({ challenge }: ActionContext) {
  try {
    const [steps, frozen] = await Promise.all([service.listSteps(challenge.uuid), service.isFrozen(challenge.uuid)]);
    return { steps: steps.map(toWire), frozen };
  } catch (error) {
    return relayScenarioError(error);
  }
}

const addStepSchema = z.object({
  title: z.string().trim().min(1).max(255),
  instructions: z.string().trim().min(1).nullish(),
});

/** `POST scenario-steps` — ajoute une étape en fin de scénario. */
export async function addStep({ challenge, request }: ActionContext) {
  try {
    const { title, instructions } = addStepSchema.parse(await request.json());
    const created = await service.addStep({
      validationChallengeId: challenge.uuid,
      title,
      instructions: instructions ?? null,
    });
    return Response.json(toWire(created), { status: 201 });
  } catch (error) {
    return relayScenarioError(error);
  }
}

// `instructions: null` vide le détail, `instructions` absent le laisse tel
// quel — d'où le .nullish() plutôt qu'un .optional() seul.
const patchStepSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    instructions: z.string().trim().min(1).nullish(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine((b) => b.title !== undefined || b.instructions !== undefined || b.position !== undefined, {
    message: "Nothing to update",
  });

/** `PATCH scenario-steps/:stepId` — renomme, réécrit ou déplace une étape. */
export async function editStep({ challenge, request, params }: ActionContext) {
  try {
    const patch = patchStepSchema.parse(await request.json());
    const updated = await service.editStep({ validationChallengeId: challenge.uuid, stepId: params.stepId, ...patch });
    return toWire(updated);
  } catch (error) {
    return relayScenarioError(error);
  }
}

/**
 * `DELETE scenario-steps/:stepId` — 409 dès qu'une walkthrough existe : c'est
 * ce refus qui empêche `validation_step_feedbacks.step_id` de pendre dans le vide.
 */
export async function removeStep({ challenge, params }: ActionContext) {
  try {
    await service.removeStep({ validationChallengeId: challenge.uuid, stepId: params.stepId });
    return { success: true };
  } catch (error) {
    return relayScenarioError(error);
  }
}
