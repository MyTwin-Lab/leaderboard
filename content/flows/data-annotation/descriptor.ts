import type { FlowDescriptor } from "../../../packages/registry/flows.js";

export const DATA_ANNOTATION_FLOW_KEY = "data-annotation";

/**
 * Données pures : lues aussi par les composants client.
 *
 * Visible publiquement pour son brief seulement : la vue anonyme ne montre
 * aucune image, les actions exigent l'adhésion.
 */
export const dataAnnotationFlowDescriptor: FlowDescriptor = {
  key: DATA_ANNOTATION_FLOW_KEY,
  label: "Annotation",
  longLabel: "Data annotation",
  icon: "tag",
  briefRequired: true,
  publiclyVisible: true,
  joinCaption: "Joining lets you label items one at a time; your pay follows your quality score.",
};
