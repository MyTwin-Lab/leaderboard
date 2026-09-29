import "server-only";
// Chemin relatif plutôt que `@packages` : Vitest ne connaît que l'alias `@`.
import { modules, type Modules } from "../../../../../../packages/capabilities/modules";

/** La clé du module produit watch. */
export const WATCH_MODULE = "watch";

/** Les réglages du module, tels que le service de recherche les lit. */
export interface WatchSettings {
  openalexMailto: string;
  defaultDomainIds: string[];
  highImpactThreshold: number;
  pageSize: number;
  cacheTtlSeconds: number;
  /** La recherche de la sélection d'accueil ; vide, les plus citées du mois. */
  spotlightQuery: string;
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
    spotlightQuery: typeof settings.spotlight_query === "string" ? settings.spotlight_query.trim() : "mammography deep learning",
  };
}
