import type { FlowDescriptor } from "../../../packages/registry/flows.js";

/**
 * Le challenge **repère** : une entrée du catalogue qui dit qu'un sujet existe
 * et à qui parler — « Community Management », « Design system » —, sans
 * board, sans dépôt, sans branche et sans personne à inscrire. Sa page est
 * la vitrine, pour tout le monde. Données pures : lues aussi par le client.
 */
export const noneFlowDescriptor: FlowDescriptor = {
  key: "none",
  label: "None",
  longLabel: "Placeholder",
  icon: "bookmark",
  briefRequired: false,
  publiclyVisible: true,
};
