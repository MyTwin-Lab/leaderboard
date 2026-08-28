import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { GitHubIcon } from "@/components/ui/GitHubIcon";
import { formatCP } from "@/lib/formatters";
import { getMedalStyle } from "@/lib/medals";
import type { ContributorRankGap } from "@/lib/types";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername?: string;
  bio?: string;
  avatarUrl?: string;
  totalCP: number;
  globalRank?: number;
  rankGap?: ContributorRankGap;
  contributingSince?: string;
  avatarSlot?: React.ReactNode;
}

function formatSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function rankGapLabel(gap: ContributorRankGap) {
  const cp = formatCP(gap.cp);
  return gap.direction === "ahead"
    ? `Leading by ${cp} CP over #${gap.rank}`
    : `${cp} CP behind #${gap.rank}`;
}

export function ContributorHeader({
  displayName,
  githubUsername,
  bio,
  avatarUrl,
  totalCP,
  globalRank,
  rankGap,
  contributingSince,
  avatarSlot,
}: ContributorHeaderProps) {
  const medal = globalRank != null && globalRank <= 3 ? getMedalStyle(globalRank) : null;

  const metaLine = [bio, contributingSince ? `contributing since ${formatSince(contributingSince)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="animate-fade-up mb-6 overflow-hidden rounded-[28px] sm:mb-8">
      <div className="flex flex-wrap items-start justify-between gap-6 p-5 sm:p-7">
        {/* Avatar + identity */}
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          <div className="relative shrink-0 animate-count-in" style={{ animationDelay: "0ms" }}>
            {avatarSlot ?? (
              <InitialsAvatar name={displayName} size={80} avatarUrl={avatarUrl} className="rounded-[24px]" />
            )}
            {medal && (
              <span
                className={`absolute -left-1.5 -top-2 flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${medal.badge}`}
              >
                {medal.label}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 pt-1">
            <div className="flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {displayName}
              </h1>
              {githubUsername && (
                <a
                  href={`https://github.com/${githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/50 transition-all duration-200 hover:scale-[1.04] hover:bg-white/15 hover:text-white/80"
                >
                  <GitHubIcon className="h-3 w-3" />
                  {githubUsername}
                </a>
              )}
              {medal == null && globalRank != null && (
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
                  #{globalRank}
                </span>
              )}
            </div>

            {metaLine && (
              <p
                className="max-w-md truncate text-sm text-white/45 animate-fade-up"
                style={{ animationDelay: "100ms" }}
              >
                {metaLine}
              </p>
            )}
          </div>
        </div>

        {/* CP figure */}
        <div className="flex shrink-0 flex-col items-end gap-1 animate-fade-up" style={{ animationDelay: "130ms" }}>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {formatCP(totalCP)}
            </span>
            <span className="text-sm font-semibold text-brandCP">CP</span>
          </span>
          {rankGap && <span className="text-xs text-white/45">{rankGapLabel(rankGap)}</span>}
        </div>
      </div>
    </div>
  );
}
