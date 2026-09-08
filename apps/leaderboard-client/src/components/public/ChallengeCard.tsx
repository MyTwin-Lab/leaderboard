'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Code2, ShieldCheck } from "lucide-react";
import { TeamAvatars } from "../ui/TeamAvatars";
import { SparkBars } from "@/components/ui/SparkBars";
import { formatCP } from "@/lib/formatters";
import type { TeamMember } from "@/lib/types";

interface ChallengeCardProps {
  challengeId: string;
  challengeTitle: string;
  challengeType?: string;
  /** Drives the "Delivered and evaluated" vs "N contributions this week" copy. */
  challengeStatus?: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0-100
  isMember?: boolean;
  isAdmin?: boolean;
  teamMembers: TeamMember[];
  /** Contributions in the last 7 days — feeds the activity row. */
  recentContributions?: number;
  activeContributors?: number;
  /** 7 daily contribution counts, oldest → newest. */
  spark?: number[];
  index?: number; // for stagger animation
  onCardClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const CHALLENGE_TYPE_BADGE: Record<string, { icon: typeof Code2; label: string }> = {
  ml: { icon: BrainCircuit, label: 'ML' },
  validation: { icon: ShieldCheck, label: 'Validation' },
};

function ChallengeTypeBadge({ type }: { type: string }) {
  const { icon: Icon, label } = CHALLENGE_TYPE_BADGE[type] ?? { icon: Code2, label: 'Code' };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

const ArrowIcon = () => (
  <svg className="h-3.5 w-3.5" style={{ color: "inherit" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

export function ChallengeCard({
  challengeId,
  challengeTitle,
  challengeType,
  challengeStatus,
  projectName,
  description,
  rewardPool,
  completion,
  isMember = false,
  isAdmin = false,
  teamMembers,
  recentContributions = 0,
  activeContributors = 0,
  spark = [0, 0, 0, 0, 0, 0, 0],
  index = 0,
  onCardClick,
}: ChallengeCardProps) {
  const normalizedType = (challengeType ?? 'code').toLowerCase();
  const done = challengeStatus === 'completed';
  const router = useRouter();
  const dest = isAdmin ? `/admin/challenges/${challengeId}` : `/challenges/${challengeId}`;
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onCardClick) { onCardClick(e); } else { router.push(dest); }
  };
  // Animate progress bar in after mount
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(completion), 120 + index * 40);
    return () => clearTimeout(t);
  }, [completion, index]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)}
      className="animate-fade-up group flex min-w-0 cursor-pointer flex-col gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brandCP/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40 sm:p-5"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ChallengeTypeBadge type={normalizedType} />
            <span className="text-xs text-white/45">{projectName}</span>
          </div>
          <h3 className="truncate text-lg font-semibold tracking-tight text-white transition-colors duration-200 group-hover:text-brandCP">
            {challengeTitle}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xl font-bold tracking-tight text-white">{formatCP(rewardPool)}</span>
          <span className="text-[10px] font-bold tracking-[0.1em] text-brandCP">CP POOL</span>
          {isMember && (
            <span className="mt-0.5 rounded-full bg-brandCP/15 px-2 py-0.5 text-[10px] font-medium text-brandCP">
              ✓ Joined
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-white/55">{description}</p>
      )}

      {/* Activity + completion + footer — pinned to the bottom of the card so
          shorter titles/descriptions don't leave a gap above them once the
          grid stretches every card in a row to the tallest one's height. */}
      <div className="mt-auto flex flex-col gap-3.5">
        {/* Activity */}
        <div className="flex items-center gap-3.5 rounded-xl bg-white/[0.04] px-3.5 py-3">
          <SparkBars values={spark} className="h-6.5 w-14 shrink-0 gap-1" barClassName="rounded-[3px]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-white">
              {done
                ? "Delivered and evaluated"
                : `${recentContributions} contribution${recentContributions !== 1 ? "s" : ""} this week`}
            </span>
            <span className="text-[11px] text-white/45">
              {done
                ? "CP distributed to the team"
                : `${activeContributors} contributor${activeContributors !== 1 ? "s" : ""} active`}
            </span>
          </div>
        </div>

        {/* Completion */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">{done ? "Completed" : "Completion"}</span>
            <span className="text-xs font-semibold text-white">{completion}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                done ? "bg-brandCP/35" : "bg-gradient-to-r from-brandCP/55 to-brandCP"
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
          <TeamAvatars members={teamMembers} maxDisplay={3} variant="floating" />
          <span
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-4.5 py-2.5 text-[13px] font-semibold transition-all duration-200 group-hover:gap-2.5"
            style={done
              ? { background: "rgba(255,255,255,0.08)", color: "var(--foreground)" }
              : { background: "var(--foreground)", color: "var(--background)" }}
          >
            {done ? "See results" : "Contribute"}
            <ArrowIcon />
          </span>
        </div>
      </div>
    </div>
  );
}
