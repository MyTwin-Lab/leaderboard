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
        className="w-full p-5 text-left cursor-pointer hover:bg-white/5 rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/50"
      >
        {/* Header: Challenge title + CP */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{challenge.title}</h3>
          <span className="text-sm font-semibold text-white">
            {formatCP(challenge.reward)} <span className="text-brandCP">CP</span>
          </span>
        </div>

        {/* Project name with chevron */}
        <div className="flex w-full items-center justify-between mt-1">
          <p className="text-sm font-medium text-white/70">Project: {challenge.projectName}</p>
          <svg
            className={`h-5 w-5 text-white/60 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
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
        <div className="w-full flex items-center justify-center">
          <div className="w-[80%] mt-4 flex flex-col items-center gap-1">
            <span className="text-sm text-brandCP">{formatPercentage(challenge.contributionShare)}</span>
            <ChallengeProgressBar value={challenge.contributionShare} />
            <span className="text-xs text-white/50 mt-1">Contribution share</span>
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
        <div ref={contentRef} className="mx-5 mb-5 pb-3 border-t border-white/10 pt-4">
          <p className="mb-3 text-xs text-white/50">Contributions ({challenge.contributions.length})</p>
          {challenge.contributions.length > 0 ? (
            <div className="space-y-2">
              {challenge.contributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-md bg-white/5 hover:bg-white/10 transition-colors duration-150"
                >
                  <div className="w-2 h-2 rounded-full bg-brandCP flex-shrink-0" />
                  <span className="text-sm text-white">{contribution.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">No detailed contributions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
