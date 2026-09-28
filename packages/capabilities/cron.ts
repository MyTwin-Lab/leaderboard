import { CronRunRepository, RefreshTokenRepository } from "../database-service/repositories/index.js";
import { PlatformRegistry, type JobDeclaration, type Owned } from "../registry/platform.js";
import { coreEventJobs } from "./events.js";
import { ownerEnabled } from "./modules.js";

/**
 * Capacité `cron` — le tick unique
 * --------------------------------
 * Le planificateur de la plateforme appelle `/api/cron/tick` chaque minute. Le
 * tick lance chaque job déclaré (core, flows, extensions, kits, modules) dont
 * l'horaire est échu depuis son dernier démarrage, pris un par un par le
 * verrou de `cron_runs`. Les jobs d'un module désactivé sont sautés.
 *
 * Les horaires sont des expressions cron à 5 champs, lues en UTC.
 */

// ─── Expressions cron ────────────────────────────────────────────────────────

export interface CronSchedule {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  daysOfMonth: ReadonlySet<number>;
  months: ReadonlySet<number>;
  /** 0 = dimanche ; 7 est lu comme 0. */
  daysOfWeek: ReadonlySet<number>;
  /** Jour du mois et jour de semaine tous deux restreints : l'un OU l'autre suffit (règle de cron). */
  domAndDowRestricted: boolean;
}

function parseField(field: string, min: number, max: number, expression: string): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    let start: number;
    let end: number;
    if (range === "*") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      [start, end] = range.split("-").map(Number);
    } else {
      start = Number(range);
      end = stepText === undefined ? start : max;
    }
    const valid =
      Number.isInteger(step) && step >= 1 &&
      Number.isInteger(start) && Number.isInteger(end) &&
      start >= min && end <= max && start <= end;
    if (!valid) throw new Error(`Invalid cron expression "${expression}": field "${field}"`);
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

export function parseCron(expression: string): CronSchedule {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression "${expression}": 5 fields expected`);
  }
  const daysOfWeek = parseField(fields[4], 0, 7, expression);
  if (daysOfWeek.delete(7)) daysOfWeek.add(0);
  return {
    minutes: parseField(fields[0], 0, 59, expression),
    hours: parseField(fields[1], 0, 23, expression),
    daysOfMonth: parseField(fields[2], 1, 31, expression),
    months: parseField(fields[3], 1, 12, expression),
    daysOfWeek,
    domAndDowRestricted: !fields[2].startsWith("*") && !fields[4].startsWith("*"),
  };
}

function dayMatches(schedule: CronSchedule, date: Date): boolean {
  if (!schedule.months.has(date.getUTCMonth() + 1)) return false;
  const dom = schedule.daysOfMonth.has(date.getUTCDate());
  const dow = schedule.daysOfWeek.has(date.getUTCDay());
  return schedule.domAndDowRestricted ? dom || dow : dom && dow;
}

/** La minute tombe dans l'horaire. */
export function matchesCron(schedule: CronSchedule | string, date: Date): boolean {
  const parsed = typeof schedule === "string" ? parseCron(schedule) : schedule;
  return (
    dayMatches(parsed, date) &&
    parsed.hours.has(date.getUTCHours()) &&
    parsed.minutes.has(date.getUTCMinutes())
  );
}

const MINUTE_MS = 60_000;
/** Assez pour un horaire mensuel ; au-delà, un job n'est jamais dû. */
const LOOKBACK_MS = 32 * 24 * 60 * MINUTE_MS;

/** La dernière échéance de l'horaire à `now` ou avant, à la minute ; `null` si aucune depuis 32 jours. */
export function lastScheduledBefore(schedule: CronSchedule | string, now: Date): Date | null {
  const parsed = typeof schedule === "string" ? parseCron(schedule) : schedule;
  const floor = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const limit = floor - LOOKBACK_MS;

  let cursor = new Date(floor);
  while (cursor.getTime() >= limit) {
    if (!dayMatches(parsed, cursor)) {
      // Dernière minute de la veille.
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()) - MINUTE_MS);
      continue;
    }
    if (!parsed.hours.has(cursor.getUTCHours())) {
      // Dernière minute de l'heure précédente.
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), cursor.getUTCHours()) - MINUTE_MS,
      );
      continue;
    }
    if (parsed.minutes.has(cursor.getUTCMinutes())) return cursor;
    cursor = new Date(cursor.getTime() - MINUTE_MS);
  }
  return null;
}

/**
 * Une première exécution (aucune ligne dans `cron_runs`) n'attrape que
 * l'échéance des 5 dernières minutes : déployer à 14 h un job quotidien de
 * 5 h ne le lance pas sur-le-champ, il attend le lendemain.
 */
const FIRST_RUN_WINDOW_MS = 5 * MINUTE_MS;

/** L'horaire est échu depuis le dernier démarrage du job. */
export function isDue(schedule: CronSchedule | string, lastStartedAt: Date | null, now: Date): boolean {
  const dueAt = lastScheduledBefore(schedule, now);
  if (!dueAt) return false;
  if (!lastStartedAt) return now.getTime() - dueAt.getTime() < FIRST_RUN_WINDOW_MS;
  return lastStartedAt.getTime() < dueAt.getTime();
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

/** Verrou par défaut : un job tombé en plein milieu redevient prenable au bout de 10 minutes. */
export const DEFAULT_LOCK_SECONDS = 600;

/** Les jobs du core : le nettoyage des sessions, et la distribution et la purge de l'outbox. */
export const coreJobs: Owned<JobDeclaration>[] = [
  {
    key: "core.refresh-tokens.cleanup",
    owner: "core",
    schedule: "0 5 * * *",
    async run() {
      return { deleted: await new RefreshTokenRepository().cleanupExpired() };
    },
  },
  ...coreEventJobs,
];

/** Tous les jobs installés : ceux du core, puis ceux de la distribution. */
export function installedJobs(): Owned<JobDeclaration>[] {
  const jobs = [...coreJobs, ...(PlatformRegistry.isInstalled() ? PlatformRegistry.jobs() : [])];
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.key)) throw new Error(`[cron] Job "${job.key}" is declared twice`);
    seen.add(job.key);
  }
  return jobs;
}

/** `skipped` : le module qui déclare le job est désactivé. */
export type JobRunStatus = "succeeded" | "failed" | "busy" | "not_due" | "skipped";

export interface JobRunSummary {
  key: string;
  owner: string;
  status: JobRunStatus;
  result?: unknown;
  error?: string;
}

export type CronRunStore = Pick<CronRunRepository, "claim" | "finish" | "findAll">;

export interface CronOptions {
  jobs?: Owned<JobDeclaration>[];
  repo?: CronRunStore;
  clock?: () => Date;
  /** Le propriétaire du job est-il actif ? Par défaut, un module désactivé ne l'est pas. */
  isOwnerEnabled?: (owner: string) => Promise<boolean>;
}

async function runClaimed(
  job: Owned<JobDeclaration>,
  repo: CronRunStore,
  clock: () => Date,
  notStartedSince?: Date,
): Promise<JobRunSummary> {
  const base = { key: job.key, owner: job.owner };
  const startedAt = clock();
  const lockUntil = new Date(startedAt.getTime() + (job.lockSeconds ?? DEFAULT_LOCK_SECONDS) * 1000);
  if (!(await repo.claim(job.key, lockUntil, startedAt, notStartedSince ?? startedAt))) {
    return { ...base, status: "busy" };
  }

  let summary: JobRunSummary;
  try {
    summary = { ...base, status: "succeeded", result: await job.run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron] Job "${job.key}" failed:`, error);
    summary = { ...base, status: "failed", error: message };
  }

  try {
    await repo.finish(job.key, summary.status === "failed" ? "failed" : "succeeded", summary.error ?? null);
  } catch (error) {
    // Le verrou expirera de lui-même : le résultat du job reste celui rapporté.
    console.error(`[cron] Could not record the end of job "${job.key}":`, error);
  }
  return summary;
}

/**
 * Le tick : chaque job dû est pris puis exécuté, un par un. Un job qui échoue
 * est journalisé et inscrit dans `cron_runs` ; les suivants tournent quand même.
 */
export async function runDueJobs(options: CronOptions = {}): Promise<JobRunSummary[]> {
  const jobs = options.jobs ?? installedJobs();
  const repo = options.repo ?? new CronRunRepository();
  const clock = options.clock ?? (() => new Date());
  const isOwnerEnabled = options.isOwnerEnabled ?? ((owner: string) => ownerEnabled(owner));

  const now = clock();
  const lastStarts = new Map((await repo.findAll()).map((run) => [run.job_key, run.last_started_at]));

  const summaries: JobRunSummary[] = [];
  for (const job of jobs) {
    if (!(await isOwnerEnabled(job.owner))) {
      summaries.push({ key: job.key, owner: job.owner, status: "skipped" });
      continue;
    }

    let dueAt: Date | null;
    let due: boolean;
    try {
      due = isDue(job.schedule, lastStarts.get(job.key) ?? null, now);
      dueAt = due ? lastScheduledBefore(job.schedule, now) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron] Job "${job.key}" has an invalid schedule:`, error);
      summaries.push({ key: job.key, owner: job.owner, status: "failed", error: message });
      continue;
    }
    if (!due || !dueAt) {
      summaries.push({ key: job.key, owner: job.owner, status: "not_due" });
      continue;
    }
    // L'échéance servie : un second tick de la même minute ne la relance pas.
    summaries.push(await runClaimed(job, repo, clock, new Date(dueAt.getTime() + 1)));
  }
  return summaries;
}

/**
 * Lance un job tout de suite, sans regarder son horaire, sous le même verrou
 * que le tick. Sert les anciennes routes `/api/cron/*`, conservées jusqu'au
 * lot L7 le temps de basculer le planificateur. Un job de module désactivé
 * est sauté, comme au tick.
 */
export async function runJobNow(key: string, options: CronOptions = {}): Promise<JobRunSummary> {
  const jobs = options.jobs ?? installedJobs();
  const job = jobs.find((candidate) => candidate.key === key);
  if (!job) throw new Error(`[cron] Unknown job "${key}"`);
  const isOwnerEnabled = options.isOwnerEnabled ?? ((owner: string) => ownerEnabled(owner));
  if (!(await isOwnerEnabled(job.owner))) return { key: job.key, owner: job.owner, status: "skipped" };
  return runClaimed(job, options.repo ?? new CronRunRepository(), options.clock ?? (() => new Date()));
}
