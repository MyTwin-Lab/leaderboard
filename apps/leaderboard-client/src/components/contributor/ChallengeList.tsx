"use client";

import { useState, type KeyboardEvent } from "react";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCP, formatPercentage } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";

interface ChallengeListProps {
  challenges: ContributorProfile["challenges"];
}

export function ChallengeList({ challenges }: ChallengeListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (challenges.length === 0) {
    return (
      <div className="rounded-md bg-white/5 p-6 text-white/60">
        No contributions yet. Please check again after the next sync.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          isExpanded={Boolean(expanded[challenge.id])}
          onToggle={() =>
            setExpanded((prev) => ({
              ...prev,
              [challenge.id]: !prev[challenge.id],
            }))
          }
        />
      ))}
    </div>
  );
}

function ChallengeCard({
  challenge,
  isExpanded,
  onToggle,
}: {
  challenge: ContributorProfile["challenges"][number];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-3 rounded-md bg-white/5 p-4 text-white shadow-sm shadow-black/20 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{challenge.title}</h3>
          <p className="text-sm text-white/60">{challenge.projectName}</p>
        </div>
        <div className="flex flex-1 items-center gap-4 sm:flex-[0_0_auto]">
          <div className="flex-1 min-w-[240px]">
            <span className="block text-xs tracking-wide text-white/50">Contribution part</span>
            <div className="relative mt-1">
              <ProgressBar value={challenge.contributionShare} />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">
                {formatPercentage(challenge.contributionShare)}
              </span>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
            {formatCP(challenge.reward)} <span className="text-brandCP">CP</span>
          </span>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-2 space-y-4 rounded-lg bg-white/5 p-4 text-sm">
          {challenge.contributions.length > 0 ? (
            challenge.contributions.map((contribution) => (
              <div key={contribution.id} className="space-y-1">
                <p className="font-medium text-white">{contribution.title}</p>
                {contribution.description ? (
                  <p className="text-white/70">{contribution.description}</p>
                ) : (
                  <p className="text-white/40 italic">Aucune description fournie.</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-white/60">Aucune contribution détaillée.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
