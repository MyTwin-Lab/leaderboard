import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import type { HomeLeaderboardEntry, HomePodiumEntry } from "@/lib/types";

interface HomeLeaderboardPreviewProps {
  podium: HomePodiumEntry[];
  rest: HomeLeaderboardEntry[];
  contributorsRanked: number;
}

const ArrowIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

const PODIUM_STYLE: Record<number, { badge: string; card: string }> = {
  1: {
    badge: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md shadow-yellow-500/40",
    card: "border-brandCP/25 bg-gradient-to-b from-brandCP/[0.08] to-white/[0.03]",
  },
  2: {
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-md shadow-slate-400/30",
    card: "border-white/10 bg-white/[0.04]",
  },
  3: {
    badge: "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-md shadow-amber-600/30",
    card: "border-white/10 bg-white/[0.04]",
  },
};

export function HomeLeaderboardPreview({ podium, rest, contributorsRanked }: HomeLeaderboardPreviewProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Leaderboard</span>
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Top contributors</h2>
        </div>
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2">
          Full ranking
          <ArrowIcon />
        </Link>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {podium.map((p, index) => {
            const style = PODIUM_STYLE[p.rank] ?? PODIUM_STYLE[3];
            return (
              <div
                key={p.userId}
                className={`animate-fade-up min-w-0 rounded-2xl border p-4 ${style.card}`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.badge}`}>
                    {p.rank}
                  </span>
                  <div className="shrink-0">
                    <InitialsAvatar name={p.name} size={48} avatarUrl={p.avatarUrl} className="rounded-2xl" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-semibold text-white">{p.name}</span>
                    {p.bio && <span className="truncate text-xs text-white/45">{p.bio}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold tracking-tight text-white sm:text-[1.4rem]">
                        {formatCP(p.cp)}
                      </span>
                      <span className="text-xs font-bold text-brandCP">CP</span>
                    </div>
                    <span className="text-[11px] text-white/45">
                      {p.contributionsCount} contribution{p.contributionsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                {/* Share bar */}
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brandCP/55 to-brandCP transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.round(p.share * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of the ranking */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {rest.length === 0 ? (
          <div className="p-6 text-center text-sm text-white/40">
            {podium.length === 0 ? "No contributions yet." : "That's everyone, for now."}
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {rest.map((entry, index) => (
              <li key={entry.userId} className="animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                <Link
                  href={`/contributors/${entry.userId}`}
                  className="group flex items-center gap-3.5 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.05] sm:px-5"
                >
                  <span className="w-5 shrink-0 text-xs font-semibold text-white/40">{entry.rank}</span>
                  <InitialsAvatar name={entry.name} size={34} avatarUrl={entry.avatarUrl} className="rounded-xl" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-white transition-colors duration-200 group-hover:text-brandCP">
                      {entry.name}
                    </span>
                    {entry.bio && <span className="truncate text-xs text-white/40">{entry.bio}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-white">
                    {formatCP(entry.cp)} <span className="text-brandCP">CP</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3.5 sm:px-5">
          <span className="text-xs text-white/50">
            {contributorsRanked} contributor{contributorsRanked !== 1 ? "s" : ""} ranked this season
          </span>
          <Link href="/leaderboard" className="text-xs font-semibold text-brandCP">
            View full leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
