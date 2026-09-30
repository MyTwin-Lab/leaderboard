import { z } from "zod";

/**
 * Réglages du module watch (`module_settings.settings`) : le contact donné à
 * OpenAlex, les domaines cherchés par défaut, les bornes de l'affichage et la
 * sélection d'accueil de `/watch`.
 *
 * `openalex_mailto` est recommandé, pas obligatoire : OpenAlex répond sans
 * lui, moins vite et avec plus de limitations (le « polite pool » lui est
 * réservé). La garde d'activation (`watchEnableBlocker`) refuse seulement un
 * email mal formé.
 *
 * La sélection d'accueil a deux modes. `query` : une recherche réglée par
 * l'admin, par pertinence. `recent` : les publications des `spotlight_window_days`
 * derniers jours, classées par `spotlight_ranking` — `impact` (les plus citées,
 * revues à fort impact seulement) ou `newest` (les plus récentes). Dans les
 * deux modes, la sélection est figée côté serveur et se renouvelle tous les
 * `spotlight_window_days` jours.
 */
export const SPOTLIGHT_MODES = ["query", "recent"] as const;
export const SPOTLIGHT_RANKINGS = ["impact", "newest"] as const;

export type SpotlightMode = (typeof SPOTLIGHT_MODES)[number];
export type SpotlightRanking = (typeof SPOTLIGHT_RANKINGS)[number];

export const watchSettingsSchema = z.object({
  openalex_mailto: z.string().trim().max(254).default(""),
  // `4` = Health Sciences (`GET https://api.openalex.org/domains`).
  default_domain_ids: z.array(z.string().regex(/^\d+$/)).min(1).max(10).default(["4"]),
  high_impact_threshold: z.number().min(0).max(1000).default(9),
  page_size: z.number().int().min(1).max(50).default(25),
  cache_ttl_seconds: z.number().int().min(0).max(86_400).default(600),
  // La sélection affichée avant toute recherche.
  spotlight_mode: z.enum(SPOTLIGHT_MODES).default("recent"),
  // Mode `query` : la recherche, par pertinence.
  spotlight_query: z.string().trim().max(300).default("mammography deep learning"),
  // Mode `recent` : la fenêtre, en jours — et, dans les deux modes, la période
  // de renouvellement de la sélection.
  spotlight_window_days: z.number().int().min(1).max(365).default(15),
  // Mode `recent` : le classement dans la fenêtre.
  spotlight_ranking: z.enum(SPOTLIGHT_RANKINGS).default("impact"),
});

export type WatchSettings = z.infer<typeof watchSettingsSchema>;

/** Ce qui empêche le module d'être actif avec ces réglages, ou `null` : un email mal formé, rien d'autre. */
export function watchEnableBlocker(settings: Record<string, unknown>): string | null {
  const mailto = typeof settings.openalex_mailto === "string" ? settings.openalex_mailto.trim() : "";
  if (mailto && !z.email().safeParse(mailto).success) return "The OpenAlex contact email is not a valid email address";
  return null;
}
