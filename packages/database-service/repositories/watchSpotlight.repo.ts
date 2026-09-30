import { db, watch_spotlight } from "../db/drizzle.js";
import { eq, sql } from "drizzle-orm";

/** Une seule sélection par instance : la ligne porte toujours cette clé. */
export const WATCH_SPOTLIGHT_KEY = "default";

/** La sélection d'accueil de `/watch`, telle qu'elle est gardée. */
export interface WatchSpotlightSnapshot<Result = unknown> {
  /** Les réglages qui l'ont produite, sérialisés : une signature différente la rend caduque. */
  signature: string;
  results: Result[];
  refreshed_at: Date;
}

/**
 * WatchSpotlightRepository
 * ------------------------
 * La sélection d'accueil du module watch (`watch_spotlight`), figée côté
 * serveur : une ligne, ses trois publications en JSON, la signature des
 * réglages qui l'ont produite et sa date. Relue à chaque visite de `/watch`,
 * réécrite quand elle a passé l'âge ou que les réglages ont changé.
 */
export class WatchSpotlightRepository {
  async find<Result = unknown>(): Promise<WatchSpotlightSnapshot<Result> | null> {
    const [row] = await db.select().from(watch_spotlight).where(eq(watch_spotlight.key, WATCH_SPOTLIGHT_KEY));
    if (!row) return null;
    return {
      signature: row.signature,
      results: (Array.isArray(row.results) ? row.results : []) as Result[],
      refreshed_at: row.refreshed_at,
    };
  }

  async save(snapshot: { signature: string; results: unknown[] }, now: Date = new Date()): Promise<void> {
    await db
      .insert(watch_spotlight)
      .values({ key: WATCH_SPOTLIGHT_KEY, signature: snapshot.signature, results: snapshot.results, refreshed_at: now })
      .onConflictDoUpdate({
        target: watch_spotlight.key,
        set: {
          signature: sql`excluded.signature`,
          results: sql`excluded.results`,
          refreshed_at: now,
        },
      });
  }
}
