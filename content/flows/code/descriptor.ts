import type { FlowDescriptor } from "../../../packages/registry/flows.js";

/** Données pures : lues aussi par les composants client. */
export const codeFlowDescriptor: FlowDescriptor = {
  key: "code",
  label: "Code",
  longLabel: "Code",
  icon: "code",
  briefRequired: true,
  publiclyVisible: true,
  joinCaption: "Joining copies the template tasks onto your board and provisions your branch.",
};
