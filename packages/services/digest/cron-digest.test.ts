import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  digestRepo: { findLatest: vi.fn() },
  service: { generate: vi.fn() },
  frequencyDays: vi.fn(),
}));

vi.mock("../../database-service/repositories/index.js", () => ({
  DigestRepository: class {
    constructor() {
      return h.digestRepo;
    }
  },
}));

vi.mock("./digest.service.js", () => ({
  DigestService: class {
    constructor() {
      return h.service;
    }
  },
  digestFrequencyDays: () => h.frequencyDays(),
}));

import { runDigestCron } from "./cron-digest.js";

const NOW = new Date("2026-09-15T05:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  h.frequencyDays.mockResolvedValue(7);
});

describe("runDigestCron", () => {
  it("does nothing while the last digest is younger than the module's frequency", async () => {
    h.digestRepo.findLatest.mockResolvedValue({ period_end: new Date("2026-09-12T05:00:00Z") });

    expect(await runDigestCron(NOW)).toEqual({ generated: false, reason: "not_due" });
    expect(h.service.generate).not.toHaveBeenCalled();
  });

  it("generates once the frequency read in the module settings has elapsed", async () => {
    h.frequencyDays.mockResolvedValue(2);
    h.digestRepo.findLatest.mockResolvedValue({ period_end: new Date("2026-09-12T05:00:00Z") });
    h.service.generate.mockResolvedValue({
      uuid: "d-1",
      period_start: new Date("2026-09-12T05:00:00Z"),
      period_end: NOW,
    });

    expect(await runDigestCron(NOW)).toEqual({
      generated: true,
      digestId: "d-1",
      period: { start: "2026-09-12T05:00:00.000Z", end: "2026-09-15T05:00:00.000Z" },
    });
    expect(h.service.generate).toHaveBeenCalledWith("cron", { now: NOW });
  });
});
