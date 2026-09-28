"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { OnboardingQuestItem } from "./OnboardingQuestItem";
import type { OnboardingQuestView } from "@/lib/server/onboarding";

interface OnboardingDrawerProps {
  /** Les quêtes installées, dans leur ordre, lues par le layout. */
  quests: OnboardingQuestView[];
}

/**
 * Le tiroir des quêtes d'onboarding. Lecture seule : une quête se valide côté
 * serveur, par l'événement qui la complète, et apparaît cochée au rendu suivant.
 */
export function OnboardingDrawer({ quests }: OnboardingDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = quests.filter((quest) => quest.completed).length;
  const totalSteps = quests.length;

  // Don't render if onboarding is complete
  if (totalSteps === 0 || completedCount === totalSteps) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 z-50 -translate-x-1/2",
        "w-full max-w-md",
        "transition-all duration-300 ease-in-out",
      )}
    >
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={cn(
          "mx-4 mb-0 overflow-hidden rounded-t-2xl",
          "bg-white/5 backdrop-blur-xl",
          "border border-white/10 border-b-0",
          "shadow-[0_-4px_30px_rgba(0,0,0,0.4)]",
          "transition-all duration-300 ease-in-out",
        )}
      >
        {/* Handle / Header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white/10"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${(completedCount / totalSteps) * 81.68} 81.68`}
                  strokeLinecap="round"
                  className="text-brandCP transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {completedCount}
              </span>
            </div>

            <div className="text-left">
              <p className="text-sm font-semibold text-white">Getting started</p>
              <p className="text-xs text-white/40">
                {completedCount}/{totalSteps} quests completed
              </p>
            </div>
          </div>

          {expanded ? (
            <ChevronDown className="h-5 w-5 text-white/40" />
          ) : (
            <ChevronUp className="h-5 w-5 text-white/40" />
          )}
        </button>

        {/* Expandable quest list */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            expanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="border-t border-white/5 px-2 py-2 space-y-0.5">
            {quests.map((quest) => (
              <OnboardingQuestItem
                key={quest.key}
                label={quest.label}
                completed={quest.completed}
                icon={<Sparkles className="h-4 w-4" />}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
