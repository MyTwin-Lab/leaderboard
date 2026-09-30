import "server-only";
import type { WatchResult } from "@/lib/watch";
import { searchWatch, type WatchSearchDeps } from "./search";
import type { WatchSettings } from "./settings";

/** Combien de publications la page montre avant toute recherche. */
export const SPOTLIGHT_SIZE = 3;

/**
 * La sélection d'accueil de `/watch` — ce que la page montre avant toute
 * recherche. Rendue côté serveur, elle est dans le HTML initial : la page ne
 * s'ouvre pas vide, et un crawler a quelque chose à lire.
 *
 * Deux modes, réglés par l'admin (`modules/watch/settings.ts`) :
 * - `query` : la recherche réglée, par pertinence, sans borne de date ;
 * - `recent` : les publications des `spotlightWindowDays` derniers jours,
 *   les plus citées des revues à fort impact (`impact`) ou les plus récentes
 *   (`newest`), dans les domaines par défaut du module.
 *
 * **Figée côté serveur.** La sélection est gardée en base (`watch_spotlight`)
 * et relue à chaque visite ; elle ne se renouvelle que tous les
 * `spotlightWindowDays` jours, ou dès que les réglages qui la produisent
 * changent. C'est ce qui la rend stable d'une visite à l'autre — et ce qui
 * sort OpenAlex du chemin de la page : une visite ordinaire ne fait aucun
 * appel.
 *
 * Le renouvellement se fait à la première visite qui trouve la sélection
 * périmée, en arrière-plan : cette visite-là lit encore l'ancienne, la
 * suivante lit la nouvelle. Un OpenAlex muet ne bloque donc rien — l'ancienne
 * reste. Seul un changement de réglages recalcule avant de rendre, pour que
 * l'admin voie tout de suite ce qu'il vient de régler.
 */

/** La sélection gardée, telle que `WatchSpotlightRepository` la rend. */
export interface WatchSpotlightStore {
  find(): Promise<{ signature: string; results: WatchResult[]; refreshed_at: Date } | null>;
  save(snapshot: { signature: string; results: WatchResult[] }, now: Date): Promise<void>;
}

export interface WatchSpotlightDeps {
  search: Partial<WatchSearchDeps>;
  store(): Promise<WatchSpotlightStore>;
  now(): Date;
  warn(message: string, error: unknown): void;
  /**
   * Comment lancer le renouvellement d'une sélection périmée : en arrière-plan
   * (défaut — la visite n'attend pas), ou en l'attendant (les tests).
   */
  background(task: () => Promise<void>): void | Promise<void>;
}

async function defaultStore(): Promise<WatchSpotlightStore> {
  // Import à la demande : lire ce module ne doit pas ouvrir la base.
  const { WatchSpotlightRepository } = await import("../../../../../../packages/database-service/repositories");
  return new WatchSpotlightRepository() as unknown as WatchSpotlightStore;
}

const DEFAULT_DEPS: WatchSpotlightDeps = {
  search: {},
  store: defaultStore,
  now: () => new Date(),
  warn: (message, error) => console.warn(`[watch] ${message}`, error),
  background: (task) => {
    void task();
  },
};

/** Le premier jour de la fenêtre, en date ISO (UTC). */
function windowStart(days: number, now: Date): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Ce qui, dans les réglages, change la sélection. Une signature différente de
 * celle gardée rend la sélection caduque, quel que soit son âge.
 */
export function spotlightSignature(settings: WatchSettings): string {
  const common = { domains: [...settings.defaultDomainIds].sort(), threshold: settings.highImpactThreshold };
  return JSON.stringify(
    settings.spotlightMode === "query"
      ? { mode: "query", query: settings.spotlightQuery.trim().toLowerCase().replace(/\s+/g, " "), ...common }
      : { mode: "recent", window: settings.spotlightWindowDays, ranking: settings.spotlightRanking, ...common },
  );
}

/** La sélection a-t-elle passé sa période de renouvellement ? */
export function spotlightExpired(refreshedAt: Date, settings: WatchSettings, now: Date): boolean {
  return now.getTime() - refreshedAt.getTime() >= settings.spotlightWindowDays * 86_400_000;
}

/**
 * Calcule la sélection auprès d'OpenAlex, par le même chemin que la recherche
 * (`searchWatch`), donc avec le même cache et les mêmes scores de revues.
 * Lève si OpenAlex ne répond pas : c'est l'appelant qui décide quoi montrer.
 */
export async function computeWatchSpotlight(
  settings: WatchSettings,
  overrides: Partial<WatchSearchDeps> = {},
  now: Date = new Date(),
): Promise<WatchResult[]> {
  const query = settings.spotlightMode === "query" ? settings.spotlightQuery.trim() : "";
  const recent = settings.spotlightMode === "recent";
  const impact = recent && settings.spotlightRanking === "impact";
  const response = await searchWatch(
    {
      q: query,
      scope: "all",
      // Un sujet réglé : ce qui compte le plus dessus, sans borne de date.
      // Les derniers jours : la fenêtre réglée.
      from: recent ? windowStart(settings.spotlightWindowDays, now) : null,
      to: null,
      topics: [],
      oa: false,
      // `impact` : les revues à fort impact seulement, les plus citées d'abord.
      high_impact: impact,
      min_cited: null,
      sort: query ? "relevance" : impact ? "cited" : "date",
      page: 1,
    },
    { settings: async () => ({ ...settings, pageSize: SPOTLIGHT_SIZE }), ...overrides },
  );
  return response.results.slice(0, SPOTLIGHT_SIZE);
}

// Un seul renouvellement en arrière-plan à la fois par processus : deux
// visites simultanées sur une sélection périmée ne font pas deux appels.
const REFRESH_KEY = "__watchSpotlightRefresh";
function refreshing(): { pending: Promise<void> | null } {
  const holder = globalThis as unknown as Record<string, { pending: Promise<void> | null } | undefined>;
  holder[REFRESH_KEY] ??= { pending: null };
  return holder[REFRESH_KEY];
}

async function refreshAndSave(
  settings: WatchSettings,
  signature: string,
  store: WatchSpotlightStore,
  deps: WatchSpotlightDeps,
): Promise<WatchResult[]> {
  const results = await computeWatchSpotlight(settings, deps.search, deps.now());
  await store.save({ signature, results }, deps.now());
  return results;
}

/**
 * La sélection à montrer — depuis la base, ou calculée si elle manque ou si
 * les réglages ont changé ; renouvelée en arrière-plan si elle a passé l'âge.
 * Ne lève jamais : sans rien à montrer, la page s'ouvre sans sélection.
 */
export async function loadWatchSpotlight(
  settings: WatchSettings,
  overrides: Partial<WatchSpotlightDeps> = {},
): Promise<WatchResult[]> {
  const deps: WatchSpotlightDeps = { ...DEFAULT_DEPS, ...overrides };
  const signature = spotlightSignature(settings);

  let store: WatchSpotlightStore;
  let saved: Awaited<ReturnType<WatchSpotlightStore["find"]>>;
  try {
    store = await deps.store();
    saved = await store.find();
  } catch (error) {
    // Sans base (ou sans table), la sélection se calcule à chaque visite,
    // comme avant qu'elle soit gardée : le cache de la recherche amortit.
    deps.warn("spotlight store unavailable, computing live", error);
    return computeWatchSpotlight(settings, deps.search, deps.now()).catch((e) => {
      deps.warn("spotlight could not be loaded", e);
      return [];
    });
  }

  // Rien de gardé, ou des réglages qui ne sont plus ceux de la sélection :
  // on calcule avant de rendre. L'admin qui vient de changer le mode voit
  // tout de suite le résultat.
  if (!saved || saved.signature !== signature) {
    try {
      return await refreshAndSave(settings, signature, store, deps);
    } catch (error) {
      deps.warn("spotlight could not be loaded", error);
      return saved?.results ?? [];
    }
  }

  // Périmée : on rend l'ancienne, et on renouvelle pour la visite suivante.
  if (spotlightExpired(saved.refreshed_at, settings, deps.now())) {
    await deps.background(async () => {
      const lock = refreshing();
      lock.pending ??= refreshAndSave(settings, signature, store, deps)
        .then(() => undefined)
        .catch((error) => deps.warn("spotlight refresh failed, keeping the previous selection", error))
        .finally(() => {
          lock.pending = null;
        });
      await lock.pending;
    });
  }

  return saved.results;
}
