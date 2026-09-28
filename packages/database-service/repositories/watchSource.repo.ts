import { db, watch_sources } from "../db/drizzle.js";
import { inArray, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

/** Une revue OpenAlex telle que le module watch la garde. */
export interface WatchSource {
  source_id: string;
  display_name: string;
  /** `summary_stats.2yr_mean_citedness` ; `null` quand OpenAlex ne le donne pas. */
  citedness_2yr: number | null;
  refreshed_at: Date;
}

export interface WatchSourceDraft {
  source_id: string;
  display_name: string;
  citedness_2yr: number | null;
}

function toDomain(row: InferSelectModel<typeof watch_sources>): WatchSource {
  return {
    source_id: row.source_id,
    display_name: row.display_name,
    citedness_2yr: row.citedness_2yr === null ? null : Number(row.citedness_2yr),
    refreshed_at: row.refreshed_at,
  };
}

/**
 * WatchSourceRepository
 * ---------------------
 * Le cache persistant des revues du module watch (`watch_sources`). Lu par
 * lots d'identifiants, écrit par upsert ; rien ne s'y supprime, une ligne
 * périmée se rafraîchit à la prochaine recherche qui la touche.
 */
export class WatchSourceRepository {
  async findMany(ids: readonly string[]): Promise<WatchSource[]> {
    if (ids.length === 0) return [];
    const rows = await db.select().from(watch_sources).where(inArray(watch_sources.source_id, [...ids]));
    return rows.map(toDomain);
  }

  async upsertMany(rows: readonly WatchSourceDraft[]): Promise<void> {
    if (rows.length === 0) return;
    const now = new Date();
    await db
      .insert(watch_sources)
      .values(
        rows.map((row) => ({
          source_id: row.source_id,
          display_name: row.display_name,
          citedness_2yr: row.citedness_2yr === null ? null : row.citedness_2yr.toFixed(3),
          refreshed_at: now,
        })),
      )
      .onConflictDoUpdate({
        target: watch_sources.source_id,
        set: {
          display_name: sql`excluded.display_name`,
          citedness_2yr: sql`excluded.citedness_2yr`,
          refreshed_at: now,
        },
      });
  }
}
