import { describe, it, expect, vi } from "vitest";

vi.mock("../../packages/database-service/repositories/index.js", () => ({
  SandboxStarRepository: class {},
  SandboxRewardRepository: class {},
}));

import { purgeIpHashes } from "./retention.js";
import { sandboxModule } from "./index.js";

const NOW = new Date("2026-09-14T03:00:00.000Z");

describe("purgeIpHashes", () => {
  it("efface les hachés d'IP de plus de 30 jours", async () => {
    const starRepo = { purgeIpHashesOlderThan: vi.fn(async (_cutoff: Date) => 7) };

    expect(await purgeIpHashes({ starRepo, now: () => NOW })).toEqual({ purged: 7 });
    expect(starRepo.purgeIpHashesOlderThan.mock.calls[0][0].toISOString()).toBe("2026-08-15T03:00:00.000Z");
  });
});

describe("sandbox module — jobs", () => {
  it("déclare la purge quotidienne des hachés d'IP", () => {
    expect(sandboxModule.jobs?.map((job) => [job.key, job.schedule])).toEqual([["sandbox.ip-hashes.purge", "0 5 * * *"]]);
  });
});
