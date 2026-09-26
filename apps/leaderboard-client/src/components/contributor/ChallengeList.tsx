"use client";

import { useState, useRef, useEffect } from "react";
import { formatCP } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { ContributionRewardBreakdown } from "./ContributionRewardBreakdown";
import { getSignalIcon } from "@/components/ui/signalIcons";

interface ChallengeListProps {
  challenges: ContributorProfile["challenges"];
}

/**
 * L'onglet Contributions, d'après `Profile Vitrine.dc.html` : une ligne par
 * challenge, qu'on déplie sur ses contributions et ses signaux de discussion.
 */
export function ChallengeList({ challenges }: ChallengeListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (challenges.length === 0) {
    return (
      <div className="v-pro-empty">
        <span className="v-pro-empty-title">No contributions yet</span>
        <span className="v-pro-empty-sub">
          Joining a challenge and shipping something puts it here.
        </span>
      </div>
    );
  }

  return (
    <div className="v-pro-rows">
      {challenges.map((challenge) => (
        <ChallengeRow
          key={challenge.id}
          challenge={challenge}
          isExpanded={Boolean(expanded[challenge.id])}
          onToggle={() =>
            setExpanded(prev => ({ ...prev, [challenge.id]: !prev[challenge.id] }))
          }
        />
      ))}
    </div>
  );
}

function ChallengeRow({
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
    <div className="v-pro-row" data-open={isExpanded}>
      <button onClick={onToggle} aria-expanded={isExpanded} className="v-pro-row-btn">
        <span className="v-pro-row-dot" />

        <div className="v-pro-row-text">
          <p className="v-pro-row-title">{challenge.title}</p>
          <p className="v-pro-row-sub">{challenge.projectName}</p>
        </div>

        <div className="v-pro-row-share">
          <div className="v-pro-row-rail">
            <div style={{ width: `${sharePercent}%` }} />
          </div>
          <span className="v-pro-row-pct">{sharePercent}%</span>
        </div>

        <span className="v-pro-row-cp">{formatCP(challenge.reward)} CP</span>

        <ChevronRight className="v-pro-row-chev" />
      </button>

      {/* Contributions — animated collapse */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? `${contentHeight}px` : '0px', opacity: isExpanded ? 1 : 0 }}
      >
        <div ref={contentRef} className="v-pro-row-body">
          <p className="v-pro-label">Contributions · {challenge.contributions.length}</p>

          {challenge.contributions.length === 0 ? (
            <p className="v-pro-note">No contributions listed</p>
          ) : (
            challenge.contributions.map((c, i) => (
              <ContributionRewardBreakdown
                key={c.id}
                contributionId={c.id}
                title={c.title}
                reward={c.reward}
                index={i}
                hasEvaluation={c.hasEvaluation}
                coMembers={c.coMembers}
              />
            ))
          )}

          {/* Slack discussion signals — aggregated chips, not a list */}
          {challenge.discussion && challenge.discussion.signals.length > 0 && (
            <>
              <p className="v-pro-label" style={{ marginTop: "0.35rem" }}>
                Discussion · <span style={{ color: "var(--v-accent)" }}>{formatCP(challenge.discussion.totalCp)} CP</span>
              </p>
              <div className="v-pro-signals">
                {challenge.discussion.signals.map(signal => {
                  const SignalIcon = getSignalIcon(signal.icon);
                  return (
                    <span key={signal.signalId} className="v-pro-signal">
                      <SignalIcon />
                      <span>{signal.label}</span>
                      {signal.count > 1 && <span className="v-pro-signal-count">×{signal.count}</span>}
                      <span className="v-pro-signal-cp">{formatCP(signal.totalCp)} CP</span>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
