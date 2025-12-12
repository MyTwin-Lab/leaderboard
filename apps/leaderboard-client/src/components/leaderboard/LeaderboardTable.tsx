"use client";

import Link from "next/link";

import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import type { LeaderboardEntry } from "@/lib/types";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";

interface LeaderboardTableProps {
  initialEntries: LeaderboardEntry[];
}

export function LeaderboardTable({ initialEntries }: LeaderboardTableProps) {
  const { entries, isLoading, error } = useLeaderboardContext();
  const list = entries.length > 0 ? entries : initialEntries;

  if (error) {
    return <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200 sm:p-6 sm:text-base">{error}</div>;
  }

  if (list.length === 0) {
    return <div className="rounded-xl bg-white/5 p-4 text-sm text-white/60 sm:p-6 sm:text-base">Aucune contribution trouvée pour ce filtre.</div>;
  }

  return (
    <div className="overflow-hidden rounded-md bg-white/5 shadow-md shadow-black/20">
      <ul className="divide-y divide-white/5">
        {list.map((entry) => (
          <li key={entry.userId}>
            <Link
              href={`/contributors/${entry.userId}`}
              className="flex items-center gap-3 px-3 py-3 transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none sm:gap-4 sm:px-4 md:gap-6 md:px-6 md:py-4"
            >
              <span className={`w-6 text-base font-bold sm:w-8 sm:text-xl ${entry.rank <= 3 ? "text-brandCP" : "text-white"}`}>
                {entry.rank}
              </span>
              <div className="shrink-0">
                <InitialsAvatar name={entry.displayName} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-white sm:text-base">{entry.displayName}</span>
                {entry.bio && <span className="hidden text-sm text-white/50 sm:block">{entry.bio}</span>}
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white sm:px-3 sm:py-1 sm:text-sm">
                {formatCP(entry.totalCP)} <span className="text-brandCP">CP</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {isLoading ? <div className="px-3 py-2 text-xs text-white/50 sm:px-6 sm:py-3 sm:text-sm">Mise à jour…</div> : null}
    </div>
  );
}
