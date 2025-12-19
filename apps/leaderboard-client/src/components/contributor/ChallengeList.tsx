"use client";

import { useState, useRef, useEffect } from "react";

import { ChallengeProgressBar } from "@/components/ui/ChallengeProgressBar";
import { formatCP, formatPercentage } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";

interface ChallengeListProps {
  challenges: ContributorProfile["challenges"];
}

export function ChallengeList({ challenges }: ChallengeListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (challenges.length === 0) {
    return (
      <div className="rounded-md bg-white/5 p-4 text-sm text-white/60 sm:p-6 sm:text-base">
        No contributions yet. Please check again after the next sync.
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      // Add buffer to ensure last item is fully visible
      setContentHeight(contentRef.current.scrollHeight + 8);
    }
  }, [isExpanded, challenge.contributions]);

  return (
    <div className="rounded-md bg-white/5 shadow-md shadow-black/20 transition-colors duration-200">
      {/* Clickable overview area */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full cursor-pointer rounded-md p-4 text-left transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/50 sm:p-5"
      >
        {/* Header: Challenge title + CP */}
        <div className="flex items-start justify-between gap-2 sm:items-center">
          <h3 className="text-base font-semibold text-white sm:text-lg">{challenge.title}</h3>
          <span className="shrink-0 text-xs font-semibold text-white sm:text-sm">
            {formatCP(challenge.reward)} <span className="text-brandCP">CP</span>
          </span>
        </div>

        {/* Project name with chevron */}
        <div className="mt-1 flex w-full items-center justify-between">
          <p className="text-xs font-medium text-white/70 sm:text-sm">Project: {challenge.projectName}</p>
          <svg
            className={`h-4 w-4 text-white/60 transition-transform duration-300 sm:h-5 sm:w-5 ${isExpanded ? "rotate-180" : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 111.04 1.08l-4.23 3.36a.75.75 0 01-.94 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Progress bar section */}
        <div className="mt-3 flex w-full items-center justify-center sm:mt-4">
          <div className="flex w-full flex-col items-center gap-1 sm:w-[80%]">
            <span className="text-xs text-brandCP sm:text-sm">{formatPercentage(challenge.contributionShare)}</span>
            <ChallengeProgressBar value={challenge.contributionShare} />
            <span className="mt-1 text-[10px] text-white/50 sm:text-xs">Contribution share</span>
          </div>
        </div>
      </button>

      {/* Animated expanded content */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="mx-4 mb-4 border-t border-white/10 pb-3 pt-3 sm:mx-5 sm:mb-5 sm:pt-4">
          <p className="mb-2 text-[10px] text-white/50 sm:mb-3 sm:text-xs">Contributions ({challenge.contributions.length})</p>
          {challenge.contributions.length > 0 ? (
            <div className="space-y-2">
              {challenge.contributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 transition-colors duration-150 hover:bg-white/10 sm:gap-3 sm:px-3 sm:py-2"
                >
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP sm:h-2 sm:w-2" />
                  <span className="text-xs text-white sm:text-sm">{contribution.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40 sm:text-sm">No detailed contributions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
