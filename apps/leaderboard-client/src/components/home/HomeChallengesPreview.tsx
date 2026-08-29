import Link from "next/link";
import { SparkBars } from "@/components/ui/SparkBars";
import { TeamAvatars } from "@/components/ui/TeamAvatars";
import { formatCP } from "@/lib/formatters";
import type { HomeTrendingChallenge } from "@/lib/types";

interface HomeChallengesPreviewProps {
  challenges: HomeTrendingChallenge[];
}

const ArrowIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} style={{ color: "inherit" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

function ChallengeCard({ ch, index }: { ch: HomeTrendingChallenge; index: number }) {
  return (
    <Link
      href={`/challenges/${ch.id}`}
      className="animate-fade-up group flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brandCP/25 hover:bg-white/[0.06] sm:p-5"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP">
              {ch.typeLabel}
            </span>
            <span className="text-xs text-white/45">{ch.projectName}</span>
          </div>
          <h3 className="truncate text-lg font-semibold tracking-tight text-white transition-colors duration-200 group-hover:text-brandCP">
            {ch.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-xl font-bold tracking-tight text-white">{formatCP(ch.rewardPool)}</span>
          <span className="text-[10px] font-bold tracking-[0.1em] text-brandCP">CP POOL</span>
        </div>
      </div>

      {/* Description */}
      {ch.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-white/55">{ch.description}</p>
      )}

      {/* Activity */}
      <div className="flex items-center gap-3.5 rounded-xl bg-white/[0.04] px-3.5 py-3">
        <SparkBars values={ch.spark} className="h-6.5 w-14 shrink-0 gap-1" barClassName="rounded-[3px]" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-white">
            {ch.recentContributions} contribution{ch.recentContributions !== 1 ? "s" : ""} this week
          </span>
          <span className="text-[11px] text-white/45">
            {ch.activeContributors} contributor{ch.activeContributors !== 1 ? "s" : ""} active
          </span>
        </div>
      </div>

      {/* Completion */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Completion</span>
          <span className="text-xs font-semibold text-white">{ch.completion}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brandCP/55 to-brandCP transition-[width] duration-700 ease-out"
            style={{ width: `${ch.completion}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
        <div className="flex items-center gap-3">
          <TeamAvatars members={ch.teamMembers} maxDisplay={3} />
          <span className="text-xs text-white/45">
            {ch.teamMembers.length} in the team
          </span>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-2 rounded-full px-4.5 py-2.5 text-[13px] font-semibold transition-all duration-200 group-hover:gap-2.5"
          style={{ background: "var(--foreground)", color: "var(--background)" }}
        >
          Contribute
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Last 7 days</span>
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Trending challenges</h2>
        </div>
        <Link href="/challenges" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2">
          All challenges
          <ArrowIcon />
        </Link>
      </div>

      {challenges.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
          No active challenge this week.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 sm:gap-4">
          {challenges.map((ch, index) => (
            <ChallengeCard key={ch.id} ch={ch} index={index} />
          ))}
        </div>
      )}

      {/* CTA banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.06] p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold text-white">No expertise required.</span>
          <span className="text-[13px] leading-relaxed text-white/55">
            You grow by contributing — code, design, research, feedback.
          </span>
        </div>
        <Link
          href="/challenges"
          className="inline-flex shrink-0 items-center rounded-full bg-brandCP px-5 py-2.5 text-[13px] font-semibold text-black transition-all duration-200 hover:-translate-y-0.5"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
