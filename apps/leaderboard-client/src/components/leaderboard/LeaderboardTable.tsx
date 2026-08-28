"use client";

import Link from "next/link";

import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";

export const RANK_STYLES: Record<number, { badge: string; glow: string; leftBar: string }> = {
  1: {
    badge: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md shadow-yellow-500/40",
    glow: "group-hover:shadow-[0_0_20px_rgba(234,179,8,0.15)]",
    leftBar: "bg-gradient-to-b from-yellow-400 to-yellow-600",
  },
  2: {
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-md shadow-slate-400/30",
    glow: "group-hover:shadow-[0_0_20px_rgba(148,163,184,0.1)]",
    leftBar: "bg-gradient-to-b from-slate-300 to-slate-500",
  },
  3: {
    badge: "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-md shadow-amber-600/30",
    glow: "group-hover:shadow-[0_0_20px_rgba(217,119,6,0.12)]",
    leftBar: "bg-gradient-to-b from-amber-500 to-amber-700",
  },
};

/** The ranking list below the podium — ranks 4+ while the podium is shown,
 * every match while searching (see LeaderboardProvider for hasPodium/rest). */
export function LeaderboardTable() {
  const { rest, hasPodium, currentUserId, error, isLoading } = useLeaderboardContext();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 sm:p-6 sm:text-base">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {hasPodium && (
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Other contributors
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}

      <div
        className="overflow-hidden rounded-2xl border border-white/10 shadow-md shadow-black/20"
        style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}
      >
        {rest.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-5 py-13 text-center">
            <span className="text-[15px] font-semibold text-white">No contributor matches</span>
            <span className="text-[13px] text-white/50">Try another project or clear the search.</span>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {rest.map((entry, index) => {
              const rankStyle = RANK_STYLES[entry.rank];

              return (
                <li
                  key={entry.userId}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index * 35, 500)}ms` }}
                >
                  <Link
                    href={`/contributors/${entry.userId}`}
                    className={`group relative flex items-center gap-3 overflow-hidden px-4 py-3 transition-all duration-200
                      hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none
                      sm:gap-4 sm:px-5 md:px-6 md:py-3.5
                      ${rankStyle?.glow ?? ""}
                    `}
                  >
                    {/* Top-3 left accent bar (search mode, before the podium takes over) */}
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
        )}

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-white/30 sm:px-6">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brandCP/60" />
            Mise à jour…
          </div>
        )}
      </div>
    </div>
  );
}
