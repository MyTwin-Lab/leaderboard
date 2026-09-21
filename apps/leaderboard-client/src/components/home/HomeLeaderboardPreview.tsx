import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import type { HomeLeaderboardEntry } from "@/lib/types";
import { HomeSectionLink, HomeSectionTitle } from "./HomeSection";

interface HomeLeaderboardPreviewProps {
  podium: HomeLeaderboardEntry[];
}

/**
 * Le top 3 du classement, en liste sobre (rang, avatar, nom, CP), lu en direct
 * et aux couleurs du thème. Le reste du classement est sur `/leaderboard`.
 */
export function HomeLeaderboardPreview({ podium }: HomeLeaderboardPreviewProps) {
  return (
    <section aria-labelledby="leaderboard-title" className="flex flex-col gap-4">
      <HomeSectionTitle id="leaderboard-title">Top 3 contributors</HomeSectionTitle>

      {podium.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
          No contributions yet.
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)]">
          {podium.map((entry, index) => {
            const first = entry.rank === 1;
            return (
              <li
                key={entry.userId}
                className={`animate-fade-up ${first ? "bg-gradient-to-r from-brandCP/[0.08] to-transparent" : ""}`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Link
                  href={`/contributors/${entry.userId}`}
                  className="group grid grid-cols-[0.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-white/[0.04] sm:grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_auto] sm:gap-3.5 sm:px-5"
                >
                  <span
                    className={`text-[13px] font-medium tabular-nums ${first ? "text-brandCP" : "text-white/40"}`}
                  >
                    {entry.rank}
                  </span>
                  <InitialsAvatar name={entry.name} size={40} avatarUrl={entry.avatarUrl} className="rounded-full" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-medium text-white transition-colors duration-200 group-hover:text-brandCP">
                      {entry.name}
                    </span>
                    {entry.bio && <span className="truncate text-[13px] text-white/50">{entry.bio}</span>}
                  </span>
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap text-base font-bold tracking-tight tabular-nums text-white sm:text-lg">
                    {formatCP(entry.cp)}
                    <span className="text-[11px] font-bold tracking-wide text-brandCP">CP</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <HomeSectionLink href="/leaderboard">Full ranking</HomeSectionLink>
    </section>
  );
}
