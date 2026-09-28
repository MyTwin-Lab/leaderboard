import { z } from "zod";

/**
 * Réglages du module watch (`module_settings.settings`) : le contact donné à
 * OpenAlex, les domaines cherchés par défaut et les bornes de l'affichage.
 *
 * `openalex_mailto` est recommandé, pas obligatoire : OpenAlex répond sans
 * lui, moins vite et avec plus de limitations (le « polite pool » lui est
 * réservé). La garde d'activation (`watchEnableBlocker`) refuse seulement un
 * email mal formé.
 */
export const watchSettingsSchema = z.object({
  openalex_mailto: z.string().trim().max(254).default(""),
  // `4` = Health Sciences (`GET https://api.openalex.org/domains`).
  default_domain_ids: z.array(z.string().regex(/^\d+$/)).min(1).max(10).default(["4"]),
  high_impact_threshold: z.number().min(0).max(1000).default(9),
  page_size: z.number().int().min(1).max(50).default(25),
  cache_ttl_seconds: z.number().int().min(0).max(86_400).default(600),
});

export type WatchSettings = z.infer<typeof watchSettingsSchema>;

/** Ce qui empêche le module d'être actif avec ces réglages, ou `null` : un email mal formé, rien d'autre. */
export function watchEnableBlocker(settings: Record<string, unknown>): string | null {
  const mailto = typeof settings.openalex_mailto === "string" ? settings.openalex_mailto.trim() : "";
  if (mailto && !z.email().safeParse(mailto).success) return "The OpenAlex contact email is not a valid email address";
  return null;
}
