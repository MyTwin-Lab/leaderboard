import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { dataAnnotationActions } from "./actions/index.js";
import {
  ANNOTATION_CONTRIBUTION_TYPE,
  ANNOTATION_RULE_KEY,
  CLAWBACK_RULE_KEY,
  ITEM,
  annotationConfigSchema,
  parseAnnotationRules,
} from "./config.js";
import { dataAnnotationFlowDescriptor } from "./descriptor.js";

export { DATA_ANNOTATION_FLOW_KEY, dataAnnotationFlowDescriptor } from "./descriptor.js";

/**
 * Flow data-annotation — des campagnes de labellisation
 * -----------------------------------------------------
 * Un admin importe des items à labelliser et des golds cachés. Chaque
 * participant tire une image à la fois (capacité `resources`) : un item reçoit
 * `k` labels puis se résout à la pluralité stricte, un gold mesure la
 * précision de l'annotateur. La précision pondère la paie et ouvre les items
 * sensibles ; un audit par échantillon reprend la paie des labels contraires
 * au consensus.
 *
 * Aucune table propre : les items, les golds et les labels sont des
 * ressources et des réclamations du core ; les compteurs sont des sommes
 * vivantes sur ces réclamations.
 */
export const dataAnnotationFlow: FlowDefinition = {
  descriptor: dataAnnotationFlowDescriptor,
  config: { version: 1, schema: annotationConfigSchema },
  rules: { parse: parseAnnotationRules },
  ruleKeys: [
    { key: ANNOTATION_RULE_KEY, consumesPool: true, label: "Annotation" },
    // Une ligne négative : elle rend ses CP au reliquat du pool.
    { key: CLAWBACK_RULE_KEY, consumesPool: true, label: "Annotation clawback" },
  ],
  contributionTypes: [{ key: ANNOTATION_CONTRIBUTION_TYPE, countsAsContribution: true }],
  uses: { board: false, groups: false },
  rewards: {
    // La mesure du hero : les items labellisés sur le total importé.
    async summarize({ challenge }) {
      const { resources } = await import("../../../packages/capabilities/resources.js");
      const counts = await resources().counts(challenge.uuid);
      const items = counts.filter((row) => row.type === ITEM);
      return {
        items_total: items.reduce((sum, row) => sum + row.total, 0),
        items_labeled: items.filter((row) => row.verdict === "labeled").reduce((sum, row) => sum + row.total, 0),
      };
    },
  },
  jobs: [
    {
      key: "annotation.audit",
      // Le lundi à 4 h UTC.
      schedule: "0 4 * * 1",
      run: async () => (await import("./audit.js")).runAnnotationAudit(),
    },
  ],
  actions: dataAnnotationActions,
};
