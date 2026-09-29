"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { OnboardingQuestItem } from "./OnboardingQuestItem";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import type { OnboardingQuestView } from "@/lib/server/onboarding";

import "@/components/vitrine/vitrine.css";
import "@/components/vitrine/forms-vitrine.css";
import "./onboarding-vitrine.css";

interface OnboardingDrawerProps {
  /** Les quêtes installées, dans leur ordre, lues par le layout. */
  quests: OnboardingQuestView[];
}

/**
 * Le tiroir des quêtes d'onboarding. Lecture seule : une quête se valide côté
 * serveur, par l'événement qui la complète, et apparaît cochée au rendu suivant.
 * Sur le design vitrine, sous sa propre racine : il se pose sur n'importe
 * quelle page.
 */
export function OnboardingDrawer({ quests }: OnboardingDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = quests.filter((quest) => quest.completed).length;
  const totalSteps = quests.length;

  // Don't render if onboarding is complete
  if (totalSteps === 0 || completedCount === totalSteps) return null;

  return (
    <div className={`vitrine-embed ${vitrineFontVars}`}>
      <div className="v-ob">
        {/* Backdrop when expanded */}
        {expanded && <div className="v-ob-backdrop" onClick={() => setExpanded(false)} />}

        <div className="v-ob-card">
          {/* Handle / Header — always visible */}
          <button type="button" onClick={() => setExpanded(!expanded)} className="v-ob-head">
            <div className="v-ob-head-left">
              {/* Progress ring */}
              <div className="v-ob-ring">
                <svg viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" className="v-ob-ring-track" />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    strokeWidth="3"
                    strokeDasharray={`${(completedCount / totalSteps) * 81.68} 81.68`}
                    strokeLinecap="round"
                    className="v-ob-ring-fill"
                  />
                </svg>
                <span className="v-ob-count">{completedCount}</span>
              </div>

              <div>
                <p className="v-ob-title">Getting started</p>
                <p className="v-ob-sub">
                  {completedCount}/{totalSteps} quests completed
                </p>
              </div>
            </div>

            {expanded ? <ChevronDown /> : <ChevronUp />}
          </button>

          {/* Expandable quest list */}
          <div className="v-ob-list" data-open={expanded ? "true" : "false"}>
            <div className="v-ob-items">
              {quests.map((quest) => (
                <OnboardingQuestItem
                  key={quest.key}
                  label={quest.label}
                  completed={quest.completed}
                  icon={<Sparkles />}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
