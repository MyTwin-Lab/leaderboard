import "server-only";
// Chemin relatif plutôt que `@packages` : Vitest ne connaît que l'alias `@`.
import { modules, type Modules } from "../../../../../../packages/capabilities/modules";

// Les mêmes valeurs que `modules/watch/settings.ts`, redites ici : le shell
// n'importe pas un module, il le lit à travers la capacité `modules`.
const SPOTLIGHT_MODES = ["query", "recent"] as const;
const SPOTLIGHT_RANKINGS = ["impact", "newest"] as const;

export type SpotlightMode = (typeof SPOTLIGHT_MODES)[number];
export type SpotlightRanking = (typeof SPOTLIGHT_RANKINGS)[number];

/** La clé du module produit watch. */
export const WATCH_MODULE = "watch";

/** Les réglages du module, tels que le service de recherche les lit. */
export interface WatchSettings {
  openalexMailto: string;
  defaultDomainIds: string[];
  highImpactThreshold: number;
  pageSize: number;
  cacheTtlSeconds: number;
  /** La sélection d'accueil : une recherche réglée, ou les derniers jours. */
  spotlightMode: SpotlightMode;
  /** Mode `query` : la recherche, par pertinence. */
  spotlightQuery: string;
  /** Mode `recent` : la fenêtre en jours ; dans les deux modes, la période de renouvellement. */
  spotlightWindowDays: number;
  /** Mode `recent` : les plus citées des revues à fort impact, ou les plus récentes. */
  spotlightRanking: SpotlightRanking;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Les réglages du module watch. Déjà validés et complétés par le schéma du
 * module (`modules.settings`) ; relus défensivement parce qu'un module absent
 * rend `{}` — le service refuse alors de chercher, faute de contact OpenAlex.
 * Les défauts sont ceux du schéma (`modules/watch/settings.ts`).
 */
export async function readWatchSettings(registry: Pick<Modules, "settings"> = modules): Promise<WatchSettings> {
  const settings = await registry.settings(WATCH_MODULE);
  const domains = Array.isArray(settings.default_domain_ids)
    ? settings.default_domain_ids.filter((id): id is string => typeof id === "string" && /^\d+$/.test(id))
    : [];
  return {
    openalexMailto: typeof settings.openalex_mailto === "string" ? settings.openalex_mailto.trim() : "",
    defaultDomainIds: domains.length > 0 ? domains : ["4"],
    highImpactThreshold: typeof settings.high_impact_threshold === "number" ? settings.high_impact_threshold : 9,
    pageSize: typeof settings.page_size === "number" ? Math.min(50, Math.max(1, Math.floor(settings.page_size))) : 25,
    cacheTtlSeconds: typeof settings.cache_ttl_seconds === "number" ? Math.max(0, settings.cache_ttl_seconds) : 600,
    spotlightMode: oneOf(settings.spotlight_mode, SPOTLIGHT_MODES, "recent"),
    spotlightQuery: typeof settings.spotlight_query === "string" ? settings.spotlight_query.trim() : "mammography deep learning",
    spotlightWindowDays:
      typeof settings.spotlight_window_days === "number"
        ? Math.min(365, Math.max(1, Math.floor(settings.spotlight_window_days)))
        : 15,
    spotlightRanking: oneOf(settings.spotlight_ranking, SPOTLIGHT_RANKINGS, "impact"),
  };
}
