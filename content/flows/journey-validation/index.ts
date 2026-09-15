import { z } from "zod";
import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { flowConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";
import { cpPerValidationSchema } from "../../kits/validation/index.js";
import { journeyValidationFlowDescriptor } from "./descriptor.js";

export { JOURNEY_VALIDATION_FLOW_KEY, journeyValidationFlowDescriptor } from "./descriptor.js";
export { assertJourneyValidationChallenge } from "./guard.js";

/**
 * Configuration, version 1 :
 * - le forfait par walkthrough complétée — pas de quorum, un parcours paie dès
 *   qu'il est complet ;
 * - `eligible_roles`, les rôles qui peuvent parcourir un scénario ;
 * - `expert_comment_qualification`, la qualification exigée pour laisser un
 *   avis expert sur une étape (`null` : pas d'avis expert). Posée par la
 *   distribution quand la création ne la précise pas (`configDefaults`).
 */
export const journeyValidationConfigSchema = z.object({
  cp_per_validation: cpPerValidationSchema,
  eligible_roles: z.array(z.string().min(1)).min(1).default(["contributor", "admin"]),
  expert_comment_qualification: z.string().min(1).nullable().default(null),
});

export interface JourneyAccess {
  eligible_roles: string[];
  expert_comment_qualification: string | null;
}

/** Qui parcourt et qui commente en expert. Configuration illisible : personne. */
export function journeyAccessOf(challenge: FlowConfigSource): JourneyAccess {
  const config = flowConfigOf(challenge);
  const roles = config?.eligible_roles;
  const expert = config?.expert_comment_qualification;
  return {
    eligible_roles: Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [],
    expert_comment_qualification: typeof expert === "string" && expert ? expert : null,
  };
}

/**
 * Flow journey-validation — des validateurs parcourent le même scénario, étape
 * par étape, dans chaque application déployée, et closent sur un retour
 * global. Chaque walkthrough complétée paie le forfait
 * (`services/challenge/scenario-steps.service.ts`,
 * `scenario-walkthrough.service.ts`).
 *
 * Prend pour cibles les livrables `deployed_app` de son challenge parent.
 */
export const journeyValidationFlow: FlowDefinition = {
  descriptor: journeyValidationFlowDescriptor,
  config: { version: 1, schema: journeyValidationConfigSchema },
  requires: { deliverableCapability: "deployed_app" },
};
