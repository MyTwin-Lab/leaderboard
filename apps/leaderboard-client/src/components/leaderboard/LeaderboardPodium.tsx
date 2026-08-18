"use client";

import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import type { LeaderboardEntry } from "@/lib/types";

const MEDAL: Record<number, string> = {
  2: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-md shadow-slate-400/30",
  3: "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-md shadow-amber-600/30",
};

function contributionsLabel(count: number) {
  return `${count} contribution${count !== 1 ? "s" : ""}`;
}

/** Top-3 podium — a larger "leader" card next to the #2/#3 pair, stacked.
 * Only rendered while there's no active search (see LeaderboardProvider). */
export function LeaderboardPodium() {
  const { podium, currentUserId } = useLeaderboardContext();

  if (podium.length === 0) return null;

  const [lead, ...rest] = podium;
  const leadCP = lead.totalCP || 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brandCP/80">
          Podium
        </span>
        <span className="h-px flex-1 bg-brandCP/20" />
      </div>

      <div
        className={`grid items-stretch gap-3 ${
          rest.length > 0 ? "sm:grid-cols-[1.12fr_1fr]" : "grid-cols-1"
        }`}
      >
        {/* Leader card */}
        <div className="animate-fade-up flex min-w-0 flex-col justify-between gap-5 rounded-[22px] border border-brandCP/25 bg-gradient-to-b from-brandCP/[0.08] to-white/[0.03] p-5 shadow-[0_22px_48px_-36px_rgba(0,0,0,0.6)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-sm font-bold text-yellow-900 shadow-md shadow-yellow-500/40">
                1
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brandCP/80">
                Leader
              </span>
            </span>
            {lead.userId === currentUserId && (
              <span className="rounded-full bg-brandCP/15 px-2.5 py-1 text-[9px] font-bold tracking-[0.1em] text-brandCP">
                YOU
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            <InitialsAvatar name={lead.displayName} size={64} avatarUrl={lead.avatarUrl} className="rounded-[20px]" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {lead.displayName}
              </span>
              {lead.bio && <span className="truncate text-sm text-white/50">{lead.bio}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-white sm:text-[2.4rem]">
                  {formatCP(lead.totalCP)}
                </span>
                <span className="text-sm font-semibold text-brandCP">CP</span>
              </span>
              <span className="text-xs text-white/45">{contributionsLabel(lead.contributionsCount)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-brandCP/55 to-brandCP" />
            </div>
          </div>
        </div>

        {/* #2 / #3 */}
        {rest.length > 0 && (
          <div className="grid grid-rows-2 gap-3">
            {rest.map((entry: LeaderboardEntry, index) => {
              const badge = MEDAL[entry.rank] ?? MEDAL[3];
              const width = Math.max(3, Math.round((entry.totalCP / leadCP) * 100));

              return (
                <div
                  key={entry.userId}
                  className="animate-fade-up flex min-w-0 flex-col justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_14px_34px_-32px_rgba(0,0,0,0.5)]"
                  style={{ animationDelay: `${(index + 1) * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
                      {entry.rank}
                    </span>
                    <InitialsAvatar name={entry.displayName} size={42} avatarUrl={entry.avatarUrl} className="rounded-2xl" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold tracking-tight text-white">
                          {entry.displayName}
                        </span>
                        {entry.userId === currentUserId && (
                          <span className="shrink-0 rounded-full bg-brandCP/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-brandCP">
                            YOU
                          </span>
                        )}
                      </div>
                      {entry.bio && <span className="truncate text-xs text-white/45">{entry.bio}</span>}
                    </div>
                    <span className="inline-flex shrink-0 items-baseline gap-1">
                      <span className="text-lg font-semibold tracking-tight text-white">
                        {formatCP(entry.totalCP)}
                      </span>
                      <span className="text-[11px] font-semibold text-brandCP">CP</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-brandCP/50" style={{ width: `${width}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] text-white/40">
                      {contributionsLabel(entry.contributionsCount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
