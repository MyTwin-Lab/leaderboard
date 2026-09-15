import { asc, eq, sql } from "drizzle-orm";
import { db, cron_runs } from "../db/drizzle.js";

export type CronRunStatus = "running" | "succeeded" | "failed";

/** Le dernier passage d'un job planifié et son verrou (`cron_runs`). */
export interface CronRun {
  job_key: string;
  last_started_at: Date | null;
  last_finished_at: Date | null;
  last_status: CronRunStatus | null;
  last_error: string | null;
  locked_until: Date | null;
}

/**
 * CronRunRepository
 * -----------------
 * Une ligne par job. `claim` est la seule porte d'entrée d'une exécution : un
 * INSERT … ON CONFLICT DO UPDATE conditionnel, donc atomique, qui ne réussit
 * que si le job n'est pas verrouillé et n'a pas déjà démarré pour cette
 * échéance. Deux ticks concurrents ne peuvent pas lancer le même job.
 */
export class CronRunRepository {
  /**
   * Prend le job jusqu'à `lockUntil`. Échoue (`false`) s'il est encore
   * verrouillé, ou s'il a déjà démarré depuis `notStartedSince` — l'échéance
   * que le tick sert. Sans `notStartedSince`, seul le verrou compte.
   */
  async claim(jobKey: string, lockUntil: Date, now: Date, notStartedSince: Date = now): Promise<boolean> {
    // Des chaînes ISO et non des Date : les colonnes sont des `timestamp` sans
    // fuseau, et une Date passée en paramètre brut serait sérialisée à l'heure
    // locale du serveur.
    const nowIso = now.toISOString();
    const result = await db.execute(sql`
      INSERT INTO cron_runs (job_key, last_started_at, last_status, last_error, locked_until)
      VALUES (${jobKey}, ${nowIso}::timestamp, 'running', NULL, ${lockUntil.toISOString()}::timestamp)
      ON CONFLICT (job_key) DO UPDATE
        SET last_started_at = EXCLUDED.last_started_at,
            last_status = 'running',
            last_error = NULL,
            locked_until = EXCLUDED.locked_until
        WHERE (cron_runs.locked_until IS NULL OR cron_runs.locked_until < ${nowIso}::timestamp)
          AND (cron_runs.last_started_at IS NULL OR cron_runs.last_started_at < ${notStartedSince.toISOString()}::timestamp)
      RETURNING job_key`);
    return result.rows.length > 0;
  }

  /** Clôt l'exécution et libère le verrou. */
  async finish(jobKey: string, status: Exclude<CronRunStatus, "running">, error: string | null): Promise<void> {
    await db
      .update(cron_runs)
      .set({ last_finished_at: new Date(), last_status: status, last_error: error, locked_until: null })
      .where(eq(cron_runs.job_key, jobKey));
  }

  async findAll(): Promise<CronRun[]> {
    const rows = await db.select().from(cron_runs).orderBy(asc(cron_runs.job_key));
    return rows.map((row) => ({ ...row, last_status: (row.last_status as CronRunStatus | null) ?? null }));
  }
}
