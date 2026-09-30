import type { ModuleDefinition } from "../../packages/registry/platform.js";
import { watchEnableBlocker, watchSettingsSchema } from "./settings.js";

export { watchSettingsSchema, watchEnableBlocker, type WatchSettings } from "./settings.js";

/**
 * Module watch — l'explorateur de publications santé, sur OpenAlex.
 *
 * Une page `/watch` et une route `GET /api/watch/search` qui proxifie
 * OpenAlex, normalise la réponse et affiche le score d'impact des revues
 * (`watch_sources`). Avant toute recherche, la page montre une sélection
 * figée en base (`watch_spotlight`) et renouvelée à la visite, tous les
 * `spotlight_window_days` jours. Aucun job, aucune intégration : on cherche,
 * on lit, on ferme. Désactivé, la page et la route répondent 404.
 *
 * Actif par défaut : la carte « Open resources » de l'accueil mène à sa page.
 * Un email de contact est recommandé pour le « polite pool » d'OpenAlex
 * (plus rapide, moins limité) ; sans lui, le service répond quand même.
 */
export const watchModule: ModuleDefinition = {
  key: "watch",
  label: "Watch",
  description: "Search the health literature on OpenAlex: topics, period, open access and journal impact.",
  defaultEnabled: true,
  settings: { schema: watchSettingsSchema },
  enableGuard: watchEnableBlocker,
};
