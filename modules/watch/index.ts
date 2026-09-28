import type { ModuleDefinition } from "../../packages/registry/platform.js";
import { watchEnableBlocker, watchSettingsSchema } from "./settings.js";

export { watchSettingsSchema, watchEnableBlocker, type WatchSettings } from "./settings.js";

/**
 * Module watch — l'explorateur de publications santé, sur OpenAlex.
 *
 * Une page `/watch` et une route `GET /api/watch/search` qui proxifie
 * OpenAlex, normalise la réponse et affiche le score d'impact des revues
 * (`watch_sources`). Aucun job, aucune intégration : on cherche, on lit, on
 * ferme. Désactivé, la page et la route répondent 404.
 *
 * Il ne s'active qu'avec un email de contact pour le « polite pool »
 * d'OpenAlex : sans lui, le service refuserait ou ralentirait les appels.
 */
export const watchModule: ModuleDefinition = {
  key: "watch",
  label: "Watch",
  description: "Search the health literature on OpenAlex: topics, period, open access and journal impact.",
  defaultEnabled: false,
  settings: { schema: watchSettingsSchema },
  enableGuard: watchEnableBlocker,
};
