import "server-only";
import { periodStart, type WatchResult } from "@/lib/watch";
import { searchWatch, type WatchSearchDeps } from "./search";
import type { WatchSettings } from "./settings";

/** Combien de publications la page montre avant toute recherche. */
export const SPOTLIGHT_SIZE = 3;

/**
 * Ce que `/watch` montre avant toute recherche : les publications santé les
 * plus citées des trente derniers jours, dans les domaines par défaut du
 * module. Rendues côté serveur, elles sont dans le HTML initial — la page ne
 * s'ouvre pas vide, et un crawler a quelque chose à lire.
 *
 * Même chemin que la recherche (`searchWatch`), donc même cache : la sélection
 * ne coûte un appel OpenAlex qu'une fois par TTL, quelle que soit l'affluence.
 * Un OpenAlex muet ne bloque pas la page : elle s'ouvre sans sélection.
 */
export async function fetchWatchSpotlight(
  settings: WatchSettings,
  overrides: Partial<WatchSearchDeps> = {},
  now: Date = new Date(),
): Promise<WatchResult[]> {
  try {
    const response = await searchWatch(
      {
        q: "",
        scope: "all",
        from: periodStart("30d", now),
        to: null,
        topics: [],
        oa: false,
        high_impact: false,
        min_cited: null,
        sort: "cited",
        page: 1,
      },
      { settings: async () => ({ ...settings, pageSize: SPOTLIGHT_SIZE }), ...overrides },
    );
    return response.results.slice(0, SPOTLIGHT_SIZE);
  } catch (error) {
    console.warn("[watch] spotlight could not be loaded", error);
    return [];
  }
}
