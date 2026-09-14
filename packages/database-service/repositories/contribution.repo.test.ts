import { describe, expect, it } from "vitest";
import { EVALUATION_STALE_AFTER_MS, isEvaluationRunning } from "./contribution.repo";

// Pendant JS de la garde SQL de claimEvaluation : un `running` récent bloque,
// un `running` orphelin (process mort en plein run) redevient prenable.
describe("isEvaluationRunning", () => {
  const now = new Date("2026-09-14T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("blocks while a recent run is in flight", () => {
    expect(isEvaluationRunning({ evaluation_status: "running", submitted_at: ago(60_000) }, now)).toBe(true);
  });

  it("releases a running status older than the timeout", () => {
    expect(
      isEvaluationRunning({ evaluation_status: "running", submitted_at: ago(EVALUATION_STALE_AFTER_MS + 1) }, now)
    ).toBe(false);
  });

  it.each(["done", "failed", "pending", undefined] as const)("does not block on status %s", (status) => {
    expect(isEvaluationRunning({ evaluation_status: status, submitted_at: ago(0) }, now)).toBe(false);
  });
});
