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
    return <div className="rounded-xl bg-red-500/10 p-6 text-red-200">{error}</div>;
  }

  if (list.length === 0) {
    return <div className="rounded-xl bg-white/5 p-6 text-white/60">Aucune contribution trouvée pour ce filtre.</div>;
  }

  return (
    <div className="overflow-hidden rounded-md bg-white/5 shadow-md shadow-black/20">
      <ul className="divide-y divide-white/5">
        {list.map((entry) => (
          <li key={entry.userId}>
            <Link
              href={`/contributors/${entry.userId}`}
              className="flex items-center gap-6 px-6 py-4 transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <span className="w-6 text-sm font-semibold text-brandCP">{entry.rank}</span>
              <InitialsAvatar name={entry.displayName} />
              <div className="flex flex-1 flex-col">
                <span className="text-base font-medium text-white">{entry.displayName}</span>
                <span className="text-sm text-white/50">@{entry.githubUsername}</span>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                {formatCP(entry.totalCP)} <span className="text-brandCP">CP</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {isLoading ? <div className="px-6 py-3 text-sm text-white/50">Mise à jour…</div> : null}
    </div>
  );
}
