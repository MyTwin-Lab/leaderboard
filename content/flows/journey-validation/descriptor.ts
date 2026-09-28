import type { FlowDescriptor } from "../../../packages/registry/flows.js";

export const JOURNEY_VALIDATION_FLOW_KEY = "journey-validation";

/**
 * Données pures : lues aussi par les composants client.
 *
 * Ni brief ni visibilité publique, comme la validation d'endpoints.
 */
export const journeyValidationFlowDescriptor: FlowDescriptor = {
  key: JOURNEY_VALIDATION_FLOW_KEY,
  label: "Validation",
  longLabel: "Journey validation",
  icon: "shield",
  // Vitrine publique, derrière le brief comme les autres : on lit, on rejoint,
  // le parcours vient après (challenge 021).
  briefRequired: true,
  publiclyVisible: true,
};
