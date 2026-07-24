"use client";

import { useState, useRef, useEffect } from "react";
import { formatCP } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";
import { ChevronRight, Award } from "lucide-react";
import { ContributionRewardBreakdown } from "./ContributionRewardBreakdown";
import { getSignalIcon } from "@/components/ui/signalIcons";

interface ChallengeListProps {
  challenges: ContributorProfile["challenges"];
}

export function ChallengeList({ challenges }: ChallengeListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-14 text-center">
        <Award className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No contributions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {challenges.map((challenge, idx) => (
        <ChallengeRow
          key={challenge.id}
          challenge={challenge}
          isExpanded={Boolean(expanded[challenge.id])}
          onToggle={() =>
            setExpanded(prev => ({ ...prev, [challenge.id]: !prev[challenge.id] }))
          }
          idx={idx}
        />
      ))}
    </div>
  );
}

function ChallengeRow({
  challenge,
  isExpanded,
  onToggle,
  idx,
}: {
  challenge: ContributorProfile["challenges"][number];
  isExpanded: boolean;
  onToggle: () => void;
  idx: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Contributions expand to reveal their reward breakdown, so this panel's
  // height changes after mount. A one-shot scrollHeight read would clip them.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => setContentHeight(el.scrollHeight + 4);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded, challenge.contributions]);

  const sharePercent = Math.round(challenge.contributionShare * 100);

  return (
    <div
      className="animate-fade-up rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors duration-200 hover:border-white/10"
      style={{ animationDelay: `${idx * 30}ms` }}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none"
      >
        {/* Dot */}
        <span className="h-2 w-2 shrink-0 rounded-full bg-brandCP/60" />

        {/* Title + project */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{challenge.title}</p>
          <p className="mt-0.5 text-xs text-white/30 truncate">{challenge.projectName}</p>
        </div>

        {/* Share bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-16 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brandCP/50 to-brandCP transition-[width] duration-700"
              style={{ width: `${sharePercent}%` }}
            />
          </div>
          <span className="text-[10px] text-white/30 w-7 text-right">{sharePercent}%</span>
        </div>

        {/* CP */}
        <span className="shrink-0 text-sm font-semibold text-brandCP">
          {formatCP(challenge.reward)} CP
        </span>

        {/* Expand chevron */}
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Contributions — animated collapse */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? `${contentHeight}px` : '0px', opacity: isExpanded ? 1 : 0 }}
      >
        <div ref={contentRef} className="border-t border-white/[0.06] px-4 pb-3 pt-2 space-y-1">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Contributions · {challenge.contributions.length}
          </p>
          {challenge.contributions.length === 0 ? (
            <p className="text-xs text-white/25 py-2">No contributions listed</p>
          ) : (
            challenge.contributions.map((c, i) => (
              <ContributionRewardBreakdown
                key={c.id}
                contributionId={c.id}
                title={c.title}
                reward={c.reward}
                index={i}
              />
            ))
          )}

          {/* Slack discussion signals — aggregated chips, not a list */}
          {challenge.discussion && challenge.discussion.signals.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                Discussion · <span className="text-brandCP/70">{formatCP(challenge.discussion.totalCp)} CP</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {challenge.discussion.signals.map(signal => {
                  const SignalIcon = getSignalIcon(signal.icon);
                  return (
                    <span
                      key={signal.signalId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60"
                    >
                      <SignalIcon className="h-3 w-3 text-brandCP/70" />
                      <span>{signal.label}</span>
                      {signal.count > 1 && <span className="text-white/30">×{signal.count}</span>}
                      <span className="font-semibold text-brandCP">{formatCP(signal.totalCp)} CP</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
