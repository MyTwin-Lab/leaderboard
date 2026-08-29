"use client";

import Link from "next/link";

import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { RANK_STYLES } from "@/components/leaderboard/LeaderboardTable";

/** Top-3 podium — same row design as "Other contributors" (LeaderboardTable),
 * stacked one below the other. Only rendered while there's no active search
 * (see LeaderboardProvider). */
export function LeaderboardPodium() {
  const { podium, currentUserId } = useLeaderboardContext();

  if (podium.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brandCP/80">
          Podium
        </span>
        <span className="h-px flex-1 bg-brandCP/20" />
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-white/10 shadow-md shadow-black/20"
        style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}
      >
        <ul className="divide-y divide-white/[0.04]">
          {podium.map((entry, index) => {
            const rankStyle = RANK_STYLES[entry.rank];

            return (
              <li
                key={entry.userId}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Link
                  href={`/contributors/${entry.userId}`}
                  className={`group relative flex items-center gap-3 overflow-hidden px-4 py-3 transition-all duration-200
                    hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none
                    sm:gap-4 sm:px-5 md:px-6 md:py-3.5
                    ${rankStyle?.glow ?? ""}
                  `}
                >
                  {/* Left accent bar */}
                  {rankStyle && (
                    <span
                      className={`absolute left-0 inset-y-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-200 group-hover:opacity-100 ${rankStyle.leftBar}`}
                    />
                  )}

                  {/* Rank badge */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                      transition-transform duration-200 group-hover:scale-110 sm:h-8 sm:w-8 sm:text-sm
                      ${rankStyle?.badge ?? "bg-white/8 text-white/40"}`}
                  >
                    {entry.rank}
                  </div>

                  {/* Avatar */}
                  <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <InitialsAvatar name={entry.displayName} size={36} avatarUrl={entry.avatarUrl} />
                  </div>

                  {/* Name + bio */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white transition-colors duration-200 group-hover:text-brandCP sm:text-base">
                        {entry.displayName}
                      </span>
                      {entry.userId === currentUserId && (
                        <span className="shrink-0 rounded-full bg-brandCP/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-brandCP">
                          YOU
                        </span>
                      )}
                    </div>
                    {entry.bio && (
                      <span className="hidden truncate text-xs text-white/35 transition-colors duration-200 group-hover:text-white/50 sm:block">
                        {entry.bio}
                      </span>
                    )}
                  </div>

                  {/* Contribution count — desktop only */}
                  <span className="hidden shrink-0 text-xs text-white/40 sm:block">
                    {entry.contributionsCount} contribution{entry.contributionsCount !== 1 ? "s" : ""}
                  </span>

                  {/* CP badge */}
                  <span
                    className={`relative shrink-0 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold
                      transition-all duration-200 group-hover:scale-105 sm:px-3 sm:py-1 sm:text-sm
                      ${rankStyle
                        ? "border-brandCP/30 bg-brandCP/10"
                        : "border-white/10 bg-white/[0.06]"
                      }`}
                  >
                    {/* Shimmer on rank 1 */}
                    {entry.rank === 1 && (
                      <span className="animate-shimmer pointer-events-none absolute inset-0 rounded-full" />
                    )}
                    <span className="relative text-white">{formatCP(entry.totalCP)}</span>{" "}
                    <span className="relative text-brandCP">CP</span>
                  </span>

                  {/* Hover arrow */}
                  <svg
                    className="h-4 w-4 shrink-0 text-white/0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/30"
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
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
