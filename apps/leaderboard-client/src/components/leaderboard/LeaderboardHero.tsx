"use client";

import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";

/** Leaderboard page header — eyebrow + H1 + a row of at-a-glance stats
 * (CP distributed, contributors ranked, scored contributions) that track
 * the selected project, independent of the search box. */
export function LeaderboardHero() {
  const { scoredEntries, projectId } = useLeaderboardContext();

  const poolCP = scoredEntries.reduce((sum, entry) => sum + entry.totalCP, 0);
  const totalItems = scoredEntries.reduce((sum, entry) => sum + entry.contributionsCount, 0);

  const headStats = [
    { value: formatCP(poolCP), label: projectId === "all" ? "CP distributed" : "CP on this project" },
    { value: String(scoredEntries.length), label: "contributors ranked" },
    { value: String(totalItems), label: "scored contributions" },
  ];

  return (
    <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <span className="flex items-center gap-2.5">
          <span className="animate-ping-slow inline-block h-1.5 w-1.5 rounded-full bg-brandCP" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brandCP">
            Live ranking
          </span>
        </span>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
          Leaderboard
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
          Every contribution is detected, evaluated and rewarded in CP by the agent. No
          gatekeepers, no invisible work.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2.5">
        {headStats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {stat.value}
            </span>
            <span className="text-[11px] text-white/45">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
