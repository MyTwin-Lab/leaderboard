import { z } from "zod";
import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { flowConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";
import { cpPerValidationSchema, quorumSchema } from "../../kits/validation/index.js";
import { endpointValidationFlowDescriptor } from "./descriptor.js";

export { ENDPOINT_VALIDATION_FLOW_KEY, endpointValidationFlowDescriptor } from "./descriptor.js";

/**
 * Configuration, version 1 :
 * - le forfait par validation et le quorum de verdicts qui résout une cible ;
 * - `reviewer_qualification`, la qualification exigée pour écrire un cas de
 *   référence, en réclamer un et rendre un verdict. Posée par la distribution
 *   quand la création ne la précise pas (`configDefaults`).
 */
export const endpointValidationConfigSchema = z.object({
  cp_per_validation: cpPerValidationSchema,
  required_validations: quorumSchema,
  reviewer_qualification: z.string().min(1),
});

/** La qualification exigée des relecteurs, ou `null` quand la configuration ne se lit pas : personne ne relit. */
export function reviewerQualificationOf(challenge: FlowConfigSource): string | null {
  const key = flowConfigOf(challenge)?.reviewer_qualification;
  return typeof key === "string" && key ? key : null;
}

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
