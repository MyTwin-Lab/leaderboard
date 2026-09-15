import type { ExtensionDefinition } from "../../../packages/registry/platform.js";

/**
 * Extension signaux Slack — détecte dans le canal d'un challenge les signaux
 * de contribution définis par son manager, et les paie au forfait, hors pool
 * (`services/slack/slack-signals.service.ts`).
 *
 * S'attache à tous les flows. Les signaux d'un participant s'agrègent dans une
 * contribution `discussion`, qui ne compte pas comme une contribution de plus.
 */
export const slackSignalsExtension: ExtensionDefinition = {
  key: "slack-signals",
  appliesTo: "*",
  ruleKeys: [{ key: "slack_signal", consumesPool: false }],
  contributionTypes: [{ key: "discussion", countsAsContribution: false }],
};
