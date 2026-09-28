import type { ActionAccess, ExtensionDefinition } from "../../../packages/registry/platform.js";
import { SLACK_SIGNAL_RULE_KEY, summarizeSignals } from "./profile.js";

export const SLACK_SIGNALS_EXTENSION_KEY = "slack-signals";

/** Régler le canal et les signaux : un admin, ou le manager du challenge. */
const EDITORS: ActionAccess = { roles: ["admin"], manager: true };

// Import à la demande : déclarer l'extension ne doit pas ouvrir la base.
const load = () => import("./actions.js");

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
  key: SLACK_SIGNALS_EXTENSION_KEY,
  appliesTo: "*",
  jobs: [
    {
      // Détecte les signaux de la veille dans les canaux des challenges.
      key: "slack-signals.detect",
      schedule: "0 6 * * *",
      // Un appel au modèle par canal : le verrou couvre une détection lente.
      lockSeconds: 1800,
      async run() {
        const { runSlackSignalsCron } = await import("../../../packages/services/slack/cron-slack-signals.js");
        return runSlackSignalsCron();
      },
    },
  ],
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
  actions: [
    // Les signaux d'un challenge se lisent par tout compte connecté.
    { path: "signals", method: "GET", access: {}, handle: async (ctx) => (await load()).listSignals(ctx) },
    { path: "signals", method: "POST", access: EDITORS, handle: async (ctx) => (await load()).createSignal(ctx) },
    { path: "signals/:signalId", method: "PUT", access: EDITORS, handle: async (ctx) => (await load()).updateSignal(ctx) },
    { path: "signals/:signalId", method: "DELETE", access: EDITORS, handle: async (ctx) => (await load()).deleteSignal(ctx) },
    { path: "config", method: "GET", access: EDITORS, handle: async (ctx) => (await load()).getConfig(ctx) },
    { path: "config", method: "PUT", access: EDITORS, handle: async (ctx) => (await load()).saveConfig(ctx) },
    { path: "config", method: "DELETE", access: EDITORS, handle: async (ctx) => (await load()).deleteConfig(ctx) },
  ],
};
