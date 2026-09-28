import { requiredDeliverableCapability } from "../../../packages/capabilities/deliverables.js";

/** Les deux façons d'éprouver un livrable que le kit sait conduire. */
export type ValidationMode = "reference_case" | "scenario";

const MODE_BY_CAPABILITY: Readonly<Record<string, ValidationMode>> = {
  endpoint: "reference_case",
  deployed_app: "scenario",
};

/**
 * Le mode d'un flow de validation, lu dans la capacité qu'il exige de son
 * challenge parent : un endpoint s'éprouve contre des cas de référence, une
 * application déployée se parcourt en scénario. `null` hors validation.
 */
export function validationModeOf(flowKey: string | null | undefined): ValidationMode | null {
  const capability = requiredDeliverableCapability(flowKey);
  return (capability && MODE_BY_CAPABILITY[capability]) || null;
}
