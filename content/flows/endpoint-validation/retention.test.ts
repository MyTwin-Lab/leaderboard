import { describe, it, expect, vi } from "vitest";
import { purgeValidationEvidence, validationContentRetentionCutoff } from "./retention.js";
import { endpointValidationFlow } from "./index.js";

const NOW = new Date("2026-09-14T03:00:00.000Z");

function makeDeps() {
  return {
    referenceCaseRepo: { purgeBytesForChallengesClosedBefore: vi.fn(async (_cutoff: Date) => 2) },
    caseClaimRepo: { purgeBytesForChallengesClosedBefore: vi.fn(async (_cutoff: Date) => 5) },
    now: () => NOW,
  };
}

describe("validationContentRetentionCutoff", () => {
  it("recule de 12 mois", () => {
    expect(validationContentRetentionCutoff(NOW).toISOString()).toBe("2025-09-14T03:00:00.000Z");
  });
});

describe("purgeValidationEvidence", () => {
  it("purge les claims et les cas des challenges fermés depuis 12 mois", async () => {
    const deps = makeDeps();

    expect(await purgeValidationEvidence(deps)).toEqual({ purgedCaseClaims: 5, purgedReferenceCases: 2 });
    expect(deps.caseClaimRepo.purgeBytesForChallengesClosedBefore.mock.calls[0][0].toISOString()).toBe("2025-09-14T03:00:00.000Z");
    expect(deps.referenceCaseRepo.purgeBytesForChallengesClosedBefore.mock.calls[0][0].toISOString()).toBe("2025-09-14T03:00:00.000Z");
  });

  it("tente les deux purges, puis signale l'échec de l'une", async () => {
    const deps = makeDeps();
    deps.caseClaimRepo.purgeBytesForChallengesClosedBefore.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(purgeValidationEvidence(deps)).rejects.toThrow("incomplete");
    expect(deps.referenceCaseRepo.purgeBytesForChallengesClosedBefore).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("endpoint-validation flow — jobs", () => {
  it("déclare la purge quotidienne des pièces", () => {
    expect(endpointValidationFlow.jobs?.map((job) => [job.key, job.schedule])).toEqual([
      ["endpoint-validation.evidence.purge", "0 5 * * *"],
    ]);
  });
});
