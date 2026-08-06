'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Code2, ShieldCheck } from "lucide-react";
import { TeamAvatars } from "../ui/TeamAvatars";
import type { TeamMember } from "@/lib/types";

interface ChallengeCardProps {
  challengeId: string;
  challengeTitle: string;
  challengeType?: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0-100
  isMember?: boolean;
  isAdmin?: boolean;
  teamMembers: TeamMember[];
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
    <span className="flex items-center gap-1 text-[11px] text-white/30">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function ChallengeCard({
  challengeId,
  challengeTitle,
  challengeType,
  projectName,
  description,
  rewardPool,
  completion,
  isMember = false,
  isAdmin = false,
  teamMembers,
  index = 0,
  onCardClick,
}: ChallengeCardProps) {
  const normalizedType = (challengeType ?? 'code').toLowerCase();
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
      className="animate-fade-up group relative flex cursor-pointer flex-col overflow-hidden
        rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-md shadow-black/20
        transition-all duration-300
        hover:-translate-y-0.5 hover:border-brandCP/25 hover:bg-white/[0.07]
        hover:shadow-[0_8px_32px_rgba(10,247,193,0.08)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40
        sm:p-5"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      {/* Top accent line — slides in on hover */}
      <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 rounded-full bg-gradient-to-r from-brandCP/80 to-brandCP/20 transition-transform duration-300 group-hover:scale-x-100" />

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-white transition-colors duration-200 group-hover:text-brandCP sm:text-lg">
            {challengeTitle}
          </h3>
          <p className="text-xs text-white/50">
            {projectName}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* CP badge */}
          <span className="relative overflow-hidden rounded-full border border-brandCP/25 bg-brandCP/10 px-2.5 py-0.5 text-xs font-semibold">
            <span className="animate-shimmer pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative text-white">{rewardPool.toLocaleString()}</span>{" "}
            <span className="relative text-brandCP">CP</span>
          </span>

          {/* Member badge */}
          {isMember && (
            <span className="rounded-full bg-brandCP/15 px-2 py-0.5 text-[10px] font-medium text-brandCP">
              ✓ Joined
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-white/50 sm:text-sm">
          {description}
        </p>
      )}

      {/* Progress bar */}
      <div className="mb-4 mt-auto">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-white/35">Completion</span>
          <span className="text-[11px] font-bold text-black">{completion}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP transition-[width] duration-700 ease-out"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-primary-100/10 pt-3.5">
        <div className="flex items-center gap-3">
          <ChallengeTypeBadge type={normalizedType} />
          <TeamAvatars members={teamMembers} variant="floating" />
        </div>

        <span className="flex items-center gap-1 text-xs font-semibold text-brandCP transition-all duration-200 group-hover:gap-1.5">
          Contribute
          <svg
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
