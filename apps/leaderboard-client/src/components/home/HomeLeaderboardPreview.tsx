import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import type { LeaderboardEntry } from "@/lib/types";

interface HomeLeaderboardPreviewProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES: Record<number, { badge: string; glow: string; leftBar: string }> = {
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

export function HomeLeaderboardPreview({ entries }: HomeLeaderboardPreviewProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        Aucune contribution pour l'instant.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md shadow-black/20">
      <ul className="divide-y divide-white/[0.04]">
        {entries.map((entry, index) => {
          const rankStyle = RANK_STYLES[entry.rank];
          const isTop3 = entry.rank <= 3;

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
                  ${rankStyle?.glow ?? ""}`}
              >
                {/* Top-3 left accent bar */}
                {isTop3 && (
                  <span
                    className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-200 group-hover:opacity-100 ${rankStyle.leftBar}`}
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
                  <span className="truncate text-sm font-medium text-white transition-colors duration-200 group-hover:text-brandCP sm:text-base">
                    {entry.displayName}
                  </span>
                  {entry.bio && (
                    <span className="hidden truncate text-xs text-white/35 transition-colors duration-200 group-hover:text-white/50 sm:block">
                      {entry.bio}
                    </span>
                  )}
                </div>

                {/* CP badge */}
                <span
                  className={`relative shrink-0 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold
                    transition-all duration-200 group-hover:scale-105 sm:px-3 sm:py-1 sm:text-sm
                    ${isTop3 ? "border-brandCP/30 bg-brandCP/10" : "border-white/10 bg-white/[0.06]"}`}
                >
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
  );
}
