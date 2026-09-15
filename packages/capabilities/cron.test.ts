import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const h = vi.hoisted(() => ({
  refreshTokenRepo: { cleanupExpired: vi.fn() },
  cronRunRepo: { claim: vi.fn(), finish: vi.fn(), findAll: vi.fn() },
}));

vi.mock("../database-service/repositories/index.js", () => ({
  RefreshTokenRepository: class {
    constructor() {
      return h.refreshTokenRepo;
    }
  },
  CronRunRepository: class {
    constructor() {
      return h.cronRunRepo;
    }
  },
}));

import { PlatformRegistry, type JobDeclaration, type Owned } from "../registry/platform.js";
import {
  coreJobs,
  installedJobs,
  isDue,
  lastScheduledBefore,
  matchesCron,
  parseCron,
  runDueJobs,
  runJobNow,
  type CronRunStore,
} from "./cron.js";

const at = (iso: string) => new Date(iso);

describe("parseCron", () => {
  it("reads values, lists, ranges and steps", () => {
    const schedule = parseCron("*/15 6-8 1,15 * 1-5");
    expect([...schedule.minutes]).toEqual([0, 15, 30, 45]);
    expect([...schedule.hours]).toEqual([6, 7, 8]);
    expect([...schedule.daysOfMonth]).toEqual([1, 15]);
    expect(schedule.months.size).toBe(12);
    expect([...schedule.daysOfWeek]).toEqual([1, 2, 3, 4, 5]);
  });

  it("reads 7 as Sunday", () => {
    expect([...parseCron("0 0 * * 7").daysOfWeek]).toEqual([0]);
  });

  it.each(["* * * *", "60 * * * *", "* 24 * * *", "*/0 * * * *", "5-1 * * * *", "a * * * *"])(
    'rejects "%s"',
    (expression) => {
      expect(() => parseCron(expression)).toThrow("Invalid cron expression");
    },
  );
});

describe("matchesCron", () => {
  it("matches a minute in UTC", () => {
    expect(matchesCron("0 5 * * *", at("2026-09-15T05:00:30Z"))).toBe(true);
    expect(matchesCron("0 5 * * *", at("2026-09-15T05:01:00Z"))).toBe(false);
  });

  it("accepts either the day of month or the day of week when both are restricted", () => {
    // 2026-09-15 est un mardi.
    expect(matchesCron("0 0 1 * 2", at("2026-09-15T00:00:00Z"))).toBe(true);
    expect(matchesCron("0 0 15 * 1", at("2026-09-15T00:00:00Z"))).toBe(true);
    expect(matchesCron("0 0 * * 1", at("2026-09-15T00:00:00Z"))).toBe(false);
  });
});

describe("lastScheduledBefore", () => {
  it("finds the latest occurrence at or before now, to the minute", () => {
    expect(lastScheduledBefore("0 5 * * *", at("2026-09-15T14:32:10Z"))?.toISOString()).toBe("2026-09-15T05:00:00.000Z");
    expect(lastScheduledBefore("0 5 * * *", at("2026-09-15T04:59:59Z"))?.toISOString()).toBe("2026-09-14T05:00:00.000Z");
    expect(lastScheduledBefore("* * * * *", at("2026-09-15T14:32:10Z"))?.toISOString()).toBe("2026-09-15T14:32:00.000Z");
    expect(lastScheduledBefore("*/15 * * * *", at("2026-09-15T10:44:30Z"))?.toISOString()).toBe("2026-09-15T10:30:00.000Z");
  });

  it("walks back across days and months", () => {
    // Le dernier lundi à 6 h avant le mardi 15 septembre 2026.
    expect(lastScheduledBefore("0 6 * * 1", at("2026-09-15T05:00:00Z"))?.toISOString()).toBe("2026-09-14T06:00:00.000Z");
    expect(lastScheduledBefore("30 23 31 * *", at("2026-09-15T05:00:00Z"))?.toISOString()).toBe("2026-08-31T23:30:00.000Z");
  });

  it("gives up beyond 32 days", () => {
    expect(lastScheduledBefore("0 0 29 2 *", at("2026-09-15T05:00:00Z"))).toBeNull();
  });
});

describe("isDue", () => {
  const NOW = at("2026-09-15T05:02:00Z");

  it("is due when the job has not started since the last occurrence", () => {
    expect(isDue("0 5 * * *", at("2026-09-14T05:00:00Z"), NOW)).toBe(true);
    expect(isDue("0 5 * * *", at("2026-09-15T05:00:01Z"), NOW)).toBe(false);
  });

  it("only catches the last 5 minutes on a first run", () => {
    expect(isDue("0 5 * * *", null, NOW)).toBe(true);
    expect(isDue("0 5 * * *", null, at("2026-09-15T14:00:00Z"))).toBe(false);
    expect(isDue("* * * * *", null, at("2026-09-15T14:00:10Z"))).toBe(true);
  });
});

function job(key: string, schedule: string, run: () => Promise<unknown> = async () => ({ ok: key })): Owned<JobDeclaration> {
  return { key, owner: `module:${key.split(".")[0]}`, schedule, run: vi.fn(run) };
}

function store(over: Partial<CronRunStore> = {}) {
  return {
    claim: vi.fn(async () => true),
    finish: vi.fn(async () => undefined),
    findAll: vi.fn(async () => []),
    ...over,
  } as CronRunStore & { claim: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn> };
}

// Ces tests portent sur l'ordonnancement : les propriétaires de leurs jobs sont actifs.
const enabledOwners = async () => true;

describe("runDueJobs", () => {
  const NOW = at("2026-09-15T05:00:20Z");
  const clock = () => NOW;

  it("claims and runs the due jobs, and skips the others", async () => {
    const repo = store({
      findAll: vi.fn(async () => [
        { job_key: "digest.generate", last_started_at: at("2026-09-14T05:00:00Z"), last_finished_at: null, last_status: "succeeded", last_error: null, locked_until: null },
        { job_key: "slack.detect", last_started_at: at("2026-09-15T04:00:00Z"), last_finished_at: null, last_status: "succeeded", last_error: null, locked_until: null },
      ] as any),
    });
    const digest = job("digest.generate", "0 5 * * *");
    const slack = job("slack.detect", "0 6 * * *");

    const summary = await runDueJobs({ jobs: [digest, slack], repo, clock, isOwnerEnabled: enabledOwners });

    expect(summary).toEqual([
      { key: "digest.generate", owner: "module:digest", status: "succeeded", result: { ok: "digest.generate" } },
      { key: "slack.detect", owner: "module:slack", status: "not_due" },
    ]);
    expect(repo.claim).toHaveBeenCalledOnce();
    const [key, lockUntil, startedAt, notStartedSince] = repo.claim.mock.calls[0];
    expect(key).toBe("digest.generate");
    expect((lockUntil as Date).getTime() - (startedAt as Date).getTime()).toBe(600_000);
    // L'échéance servie : un démarrage à 05:00:00 ou après la couvre déjà.
    expect((notStartedSince as Date).toISOString()).toBe("2026-09-15T05:00:00.001Z");
    expect(repo.finish).toHaveBeenCalledWith("digest.generate", "succeeded", null);
    expect(slack.run).not.toHaveBeenCalled();
  });

  it("reports a job another tick already holds, without running it", async () => {
    const repo = store({ claim: vi.fn(async () => false) });
    const every = job("compute.expiration", "* * * * *");

    const summary = await runDueJobs({ jobs: [every], repo, clock, isOwnerEnabled: enabledOwners });

    expect(summary[0].status).toBe("busy");
    expect(every.run).not.toHaveBeenCalled();
    expect(repo.finish).not.toHaveBeenCalled();
  });

  it("records a failure and keeps running the next jobs", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = store();
    const failing = job("meetings.check", "* * * * *", async () => { throw new Error("Meet down"); });
    const next = job("compute.provisioning", "* * * * *");

    const summary = await runDueJobs({ jobs: [failing, next], repo, clock, isOwnerEnabled: enabledOwners });

    expect(summary.map((s) => s.status)).toEqual(["failed", "succeeded"]);
    expect(summary[0].error).toBe("Meet down");
    expect(repo.finish).toHaveBeenCalledWith("meetings.check", "failed", "Meet down");
    errorSpy.mockRestore();
  });

  it("reports an invalid schedule as a failed job", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const summary = await runDueJobs({ jobs: [job("broken.job", "every minute")], repo: store(), clock, isOwnerEnabled: enabledOwners });

    expect(summary[0]).toMatchObject({ status: "failed" });
    errorSpy.mockRestore();
  });
});

describe("runJobNow", () => {
  it("runs a job regardless of its schedule, under the lock", async () => {
    const repo = store();
    const daily = job("digest.generate", "0 5 * * *");

    const summary = await runJobNow("digest.generate", { jobs: [daily], repo, clock: () => at("2026-09-15T14:00:00Z"), isOwnerEnabled: enabledOwners });

    expect(summary.status).toBe("succeeded");
    expect(repo.claim).toHaveBeenCalledOnce();
  });

  it("refuses an unknown job", async () => {
    await expect(runJobNow("nope", { jobs: [], repo: store(), isOwnerEnabled: enabledOwners })).rejects.toThrow('Unknown job "nope"');
  });
});

describe("core jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cleans the expired refresh tokens every day", async () => {
    h.refreshTokenRepo.cleanupExpired.mockResolvedValue(4);
    const [cleanup] = coreJobs;

    expect([cleanup.key, cleanup.owner, cleanup.schedule]).toEqual(["core.refresh-tokens.cleanup", "core", "0 5 * * *"]);
    expect(await cleanup.run()).toEqual({ deleted: 4 });
  });
});

describe("PlatformRegistry — jobs", () => {
  const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });
  const noop = async () => undefined;

  afterAll(() => {
    PlatformRegistry.reset();
  });

  it("lists every declared job with its owner, after the core ones", () => {
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [{ descriptor: descriptor("demo"), jobs: [{ key: "demo.purge", schedule: "0 5 * * *", run: noop }] }],
      modules: [{ key: "digest", jobs: [{ key: "digest.generate", schedule: "0 5 * * *", run: noop }] }],
    });

    expect(PlatformRegistry.jobs().map((j) => [j.key, j.owner])).toEqual([
      ["demo.purge", "flow:demo"],
      ["digest.generate", "module:digest"],
    ]);
    expect(installedJobs().map((j) => j.key)).toEqual(["core.refresh-tokens.cleanup", "core.events.distribute", "core.events.purge", "demo.purge", "digest.generate"]);
  });

  it("refuses a job key declared twice", () => {
    PlatformRegistry.reset();

    expect(() =>
      PlatformRegistry.install({
        flows: [{ descriptor: descriptor("demo"), jobs: [{ key: "shared.job", schedule: "* * * * *", run: noop }] }],
        extensions: [{ key: "extra", appliesTo: "*", jobs: [{ key: "shared.job", schedule: "* * * * *", run: noop }] }],
      }),
    ).toThrow('Job "shared.job" is declared by both flow:demo and extension:extra');
    expect(PlatformRegistry.isInstalled()).toBe(false);
  });
});
