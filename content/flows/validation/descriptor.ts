import type { FlowDescriptor } from "../../../packages/registry/flows.js";

/**
 * Données pures : lues aussi par les composants client.
 *
 * Ni brief ni visibilité publique : aucune route de validation ne vérifie
 * l'appartenance à l'équipe, et la page publique n'a rien à montrer d'un
 * challenge de validation (ni métriques, ni progression de board).
 */
export const validationFlowDescriptor: FlowDescriptor = {
  key: "validation",
  label: "Validation",
  longLabel: "Validation",
  icon: "shield",
  briefRequired: false,
  publiclyVisible: false,
};
