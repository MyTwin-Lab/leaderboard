import type { OnboardingStep } from "../../../../packages/database-service/domain/entities";

/**
 * Fire-and-forget helper to mark an onboarding step as complete.
 * Safe to call from any client component — silently no-ops on error.
 */
export function trackOnboardingStep(step: OnboardingStep): void {
  fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
  }).catch(() => {
    // Silently ignore — onboarding tracking is non-critical
  });
}
