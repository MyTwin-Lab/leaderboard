import { describe, it, expect, vi } from "vitest";
import type { JobDeclaration, Owned } from "../registry/platform.js";
import { coreJobs, runDueJobs, runJobNow, type CronRunStore } from "./cron.js";

function store(): CronRunStore & { claim: ReturnType<typeof vi.fn> } {
  return {
    claim: vi.fn(async () => ({ job_key: "x" }) as never),
    finish: vi.fn(async () => undefined) as never,
    findAll: vi.fn(async () => []),
  };
}

const moduleJob: Owned<JobDeclaration> = {
  key: "digest.generate",
  owner: "module:digest",
  schedule: "* * * * *",
  run: vi.fn(async () => "generated"),
};

describe("cron — disabled modules", () => {
  it("skips the jobs of a disabled module without claiming them", async () => {
    const repo = store();

    const summaries = await runDueJobs({ jobs: [moduleJob], repo, isOwnerEnabled: async () => false });

    expect(summaries).toEqual([{ key: "digest.generate", owner: "module:digest", status: "skipped" }]);
    expect(repo.claim).not.toHaveBeenCalled();
    expect(moduleJob.run).not.toHaveBeenCalled();
  });

  it("skips them when run by an old cron route too", async () => {
    const repo = store();

    expect(await runJobNow("digest.generate", { jobs: [moduleJob], repo, isOwnerEnabled: async () => false })).toEqual({
      key: "digest.generate",
      owner: "module:digest",
      status: "skipped",
    });
    expect(repo.claim).not.toHaveBeenCalled();
  });

  it("runs the outbox distribution and purge as core jobs", () => {
    expect(coreJobs.map((job) => job.key)).toEqual(
      expect.arrayContaining(["core.events.distribute", "core.events.purge"]),
    );
  });
});
