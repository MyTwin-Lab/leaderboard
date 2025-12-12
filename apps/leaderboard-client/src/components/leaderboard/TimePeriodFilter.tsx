"use client";

import { useLeaderboardContext, type TimePeriod } from "@/components/leaderboard/LeaderboardProvider";

export function TimePeriodFilter() {
  const { timePeriod, setTimePeriod } = useLeaderboardContext();

  const periods: { value: TimePeriod; label: string }[] = [
    { value: "all", label: "All Time" },
    { value: "month", label: "Last month" },
    { value: "week", label: "Last week" },
  ];

  return (
    <div className="flex items-center justify-center gap-0 rounded-md border border-white/10 bg-white/5 p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => setTimePeriod(period.value)}
          className={`flex-1 rounded-md px-6 py-2 text-sm font-medium transition-all ${
            timePeriod === period.value
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
