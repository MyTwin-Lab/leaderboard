import type { ExtensionDefinition } from "../../../packages/registry/platform.js";
import { SLACK_SIGNAL_RULE_KEY, summarizeSignals } from "./profile.js";

/**
 * Extension signaux Slack — détecte dans le canal d'un challenge les signaux
 * de contribution définis par son manager, et les paie au forfait, hors pool
 * (`services/slack/slack-signals.service.ts`).
 *
 * S'attache à tous les flows. Les signaux d'un participant s'agrègent dans une
 * contribution `discussion`, qui ne compte pas comme une contribution de plus
 * et se résume en chips sur son profil.
 */
export const slackSignalsExtension: ExtensionDefinition = {
  key: "slack-signals",
  appliesTo: "*",
  ruleKeys: [
    {
      key: SLACK_SIGNAL_RULE_KEY,
      consumesPool: false,
      label: "Slack signal",
      // Le signal est nommé par le manager : la ligne porte son libellé.
      describe: (meta) => (typeof meta?.signal_label === "string" ? meta.signal_label : undefined),
    },
  ],
  contributionTypes: [
    {
      key: "discussion",
      countsAsContribution: false,
      profileAggregate: { title: "Discussion", summarize: summarizeSignals },
    },
  ],
};
