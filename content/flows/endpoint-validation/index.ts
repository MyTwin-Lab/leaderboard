import { z } from "zod";
import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { cpPerValidationSchema, quorumSchema } from "../../kits/validation/index.js";
import { endpointValidationFlowDescriptor } from "./descriptor.js";

export { ENDPOINT_VALIDATION_FLOW_KEY, endpointValidationFlowDescriptor } from "./descriptor.js";

/**
 * Configuration, version 1 : le forfait par validation et le quorum de
 * verdicts qui résout une cible.
 */
export const endpointValidationConfigSchema = z.object({
  cp_per_validation: cpPerValidationSchema,
  required_validations: quorumSchema,
});

/**
 * Flow endpoint-validation — des validateurs qualifiés éprouvent chaque
 * endpoint exposé contre un cas de référence : réclamation d'un cas, appel de
 * l'endpoint, observation, révélation du résultat attendu, verdict. Une cible
 * se résout à la majorité une fois le quorum atteint, et la majorité est payée
 * (`services/challenge/reference-case.service.ts`,
 * `validation-challenge.service.ts`).
 *
 * Prend pour cibles les livrables `endpoint` de son challenge parent.
 */
export const endpointValidationFlow: FlowDefinition = {
  descriptor: endpointValidationFlowDescriptor,
  config: { version: 1, schema: endpointValidationConfigSchema },
  requires: { deliverableCapability: "endpoint" },
};
