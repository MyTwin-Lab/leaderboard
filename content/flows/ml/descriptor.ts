import type { FlowDescriptor } from "../../../packages/registry/flows.js";

/** Données pures : lues aussi par les composants client. */
export const mlFlowDescriptor: FlowDescriptor = {
  key: "ml",
  label: "ML",
  longLabel: "Machine learning",
  icon: "brain",
  briefRequired: true,
  publiclyVisible: true,
  joinCaption: "Joining adds you to this challenge - you can then submit your dataset and model.",
};
