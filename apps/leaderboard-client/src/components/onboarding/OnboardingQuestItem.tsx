"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OnboardingQuestItemProps {
  label: string;
  completed: boolean;
  icon: React.ReactNode;
}

export function OnboardingQuestItem({ label, completed, icon }: OnboardingQuestItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
        completed ? "opacity-60" : "opacity-100",
      )}
    >
      {/* Status indicator */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
          completed
            ? "bg-brandCP/20 text-brandCP"
            : "bg-white/10 text-white/50",
        )}
      >
        {completed ? <Check className="h-4 w-4" /> : icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            completed ? "text-white/50 line-through" : "text-white",
          )}
        >
          {label}
        </p>
      </div>

      {/* Completed badge */}
      {completed && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brandCP">
          Done
        </span>
      )}
    </div>
  );
}
