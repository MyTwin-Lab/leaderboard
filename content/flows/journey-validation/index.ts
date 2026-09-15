import { z } from "zod";
import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { cpPerValidationSchema } from "../../kits/validation/index.js";
import { journeyValidationFlowDescriptor } from "./descriptor.js";

export { JOURNEY_VALIDATION_FLOW_KEY, journeyValidationFlowDescriptor } from "./descriptor.js";
export { assertJourneyValidationChallenge } from "./guard.js";

/**
 * Configuration, version 1 : le forfait par walkthrough complétée. Pas de
 * quorum — un parcours ne se résout pas, il paie dès qu'il est complet.
 */
export const journeyValidationConfigSchema = z.object({
  cp_per_validation: cpPerValidationSchema,
});

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
