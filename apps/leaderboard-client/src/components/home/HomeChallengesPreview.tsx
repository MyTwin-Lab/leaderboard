import Link from "next/link";
import { TeamAvatars } from "@/components/ui/TeamAvatars";
import { formatCP } from "@/lib/formatters";
import { challengePath } from "@/lib/paths";
import type { HomeTrendingChallenge } from "@/lib/types";
import { ArrowIcon } from "./ArrowIcon";
import { HomeSectionLink, HomeSectionTitle } from "./HomeSection";

interface HomeChallengesPreviewProps {
  challenges: HomeTrendingChallenge[];
}

function ChallengeCard({ ch, index }: { ch: HomeTrendingChallenge; index: number }) {
  return (
    <Link
      href={challengePath(ch.slug)}
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

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
        <TeamAvatars members={ch.teamMembers} maxDisplay={3} />
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
    <section aria-labelledby="trending-challenges-title" className="flex min-w-0 flex-col gap-4">
      <HomeSectionTitle id="trending-challenges-title">Challenges</HomeSectionTitle>

      {challenges.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
          No active challenge this week.
        </div>
      ) : (
        <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2">
          {challenges.map((ch, index) => (
            <ChallengeCard key={ch.id} ch={ch} index={index} />
          ))}
        </div>
      )}

      <HomeSectionLink href="/challenges">All challenges</HomeSectionLink>
    </section>
  );
}
