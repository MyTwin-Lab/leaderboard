"use client";

import { useState, useCallback } from "react";
import type { OnboardingProgress, OnboardingStep } from "../../../../../packages/database-service/domain/entities";

const ALL_STEPS: OnboardingStep[] = [
  "clicked_challenge",
  "assigned_task",
  "evaluated_contribution",
  "validated_task",
  "joined_meeting",
];

export function useOnboarding(initialProgress: OnboardingProgress) {
  const [progress, setProgress] = useState<OnboardingProgress>(initialProgress);

  const completedCount = ALL_STEPS.filter((s) => progress[s]).length;
  const isComplete = !!progress.completed_at || completedCount === ALL_STEPS.length;

  const markStep = useCallback(
    async (step: OnboardingStep) => {
      // Already done — skip
      if (progress[step]) return;

      // Optimistic update
      setProgress((prev) => ({ ...prev, [step]: true }));

      try {
        const res = await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });

        if (res.ok) {
          const updated: OnboardingProgress = await res.json();
          setProgress(updated);
        }
      } catch {
        // Revert optimistic update on error
        setProgress((prev) => ({ ...prev, [step]: false }));
      }
    },
    [progress],
  );

  return { progress, completedCount, totalSteps: ALL_STEPS.length, isComplete, markStep };
}
