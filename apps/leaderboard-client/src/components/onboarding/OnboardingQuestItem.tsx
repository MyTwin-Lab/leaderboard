"use client";

import { Check } from "lucide-react";

interface OnboardingQuestItemProps {
  label: string;
  completed: boolean;
  icon: React.ReactNode;
}

/** Une quête du tiroir d'onboarding (`.v-ob-quest`, dans `onboarding-vitrine.css`). */
export function OnboardingQuestItem({ label, completed, icon }: OnboardingQuestItemProps) {
  return (
    <div className="v-ob-quest" data-done={completed ? "true" : "false"}>
      {/* Status indicator */}
      <div className="v-ob-quest-icon">{completed ? <Check /> : icon}</div>

      {/* Text */}
      <p className="v-ob-quest-label">{label}</p>

      {/* Completed badge */}
      {completed && <span className="v-ob-quest-done">Done</span>}
    </div>
  );
}
