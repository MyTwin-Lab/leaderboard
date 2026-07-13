import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername?: string;
  avatarUrl?: string;
  totalCP: number;
  totalContributions?: number;
  completedChallenges?: number;
  globalRank?: number;
  avatarSlot?: React.ReactNode;
}

export function ContributorHeader({ displayName, githubUsername, avatarUrl, totalCP, totalContributions, completedChallenges, globalRank, avatarSlot }: ContributorHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-4 sm:mb-8 sm:gap-5">
      {/* Avatar — static or custom slot (e.g. clickable upload) */}
      {avatarSlot ?? (
        <div className="shrink-0 animate-count-in" style={{ animationDelay: '0ms' }}>
          <InitialsAvatar name={displayName} size={64} avatarUrl={avatarUrl} />
        </div>
      )}

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          className="flex flex-wrap items-center gap-2 animate-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <h1 className="text-lg font-semibold text-white sm:text-xl">{displayName}</h1>
          {githubUsername && (
            <a
              href={`https://github.com/${githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-xs text-white/50 transition-all duration-200 hover:bg-white/15 hover:text-white/80 hover:scale-[1.04]"
            >
              <svg width="11" height="11" viewBox="0 0 21 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 21V17C14.1391 15.7473 13.7799 14.4901 13 13.5C16 13.5 19 11.5 19 8C19.08 6.75 18.73 5.52 18 4.5C18.28 3.35 18.28 2.15 18 1C18 1 17 1 15 2.5C12.36 2 9.64 2 7 2.5C5 1 4 1 4 1C3.7 2.15 3.7 3.35 4 4.5C3.27187 5.51588 2.91847 6.75279 3 8C3 11.5 6 13.5 9 13.5C8.61 13.99 8.32 14.55 8.15 15.15C7.98 15.75 7.93 16.38 8 17M8 17V21M8 17C3.49 19 3 15 1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {githubUsername}
            </a>
          )}
        </div>

        {/* Stats row — staggered */}
        <div
          className="flex flex-wrap gap-2 animate-fade-up"
          style={{ animationDelay: '130ms' }}
        >
          {/* CP badge with glow */}
          <span className="animate-glow-pulse rounded-full border border-brandCP/30 bg-brandCP/10 px-3 py-0.5 text-xs font-semibold">
            <span className="text-white">{formatCP(totalCP)}</span>{" "}
            <span className="text-brandCP">CP</span>
          </span>
          {completedChallenges != null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60">
              {completedChallenges} challenge{completedChallenges !== 1 ? "s" : ""}
            </span>
          )}
          {globalRank != null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60">
              #{globalRank}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
