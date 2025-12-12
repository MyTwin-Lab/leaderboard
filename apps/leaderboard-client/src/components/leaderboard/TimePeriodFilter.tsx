"use client";

import { useLeaderboardContext, type TimePeriod } from "@/components/leaderboard/LeaderboardProvider";

export function TimePeriodFilter() {
  const { timePeriod, setTimePeriod } = useLeaderboardContext();

  const periods: { value: TimePeriod; label: string; shortLabel: string }[] = [
    { value: "all", label: "All Time", shortLabel: "All" },
    { value: "month", label: "Last month", shortLabel: "Month" },
    { value: "week", label: "Last week", shortLabel: "Week" },
  ];

  return (
    <div className="flex items-center justify-center gap-0 rounded-md border border-white/10 bg-white/5 p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => setTimePeriod(period.value)}
          className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all sm:px-6 sm:py-2 sm:text-sm ${
            timePeriod === period.value
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          <span className="sm:hidden">{period.shortLabel}</span>
          <span className="hidden sm:inline">{period.label}</span>
        </button>
      ))}
    </div>
  );
}
