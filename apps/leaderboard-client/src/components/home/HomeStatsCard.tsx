import { SparkBars } from "@/components/ui/SparkBars";
import type { HomeStat } from "@/lib/types";

interface HomeStatsCardProps {
  stats: HomeStat[];
  spark: number[];
}

export function HomeStatsCard({ stats, spark }: HomeStatsCardProps) {
  return (
    <div
      className="animate-fade-up flex w-full min-w-0 flex-col gap-1 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)] sm:p-6 lg:w-[360px] lg:shrink-0"
      style={{ animationDelay: "80ms" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
          The Lab, right now
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brandCP">
          <span className="animate-ping-slow inline-block h-1.5 w-1.5 rounded-full bg-brandCP" />
          Live
        </span>
      </div>

      {/* Stat rows */}
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] py-4"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
              {stat.value}
            </span>
            <span className="text-[13px] text-white/50">{stat.label}</span>
          </div>
          <span className="shrink-0 text-right text-xs font-semibold text-brandCP">
            {stat.delta}
          </span>
        </div>
      ))}

      {/* Spark chart */}
      <div className="flex flex-col gap-2.5 pt-4">
        <span className="text-xs text-white/50">Contributions, last 7 days</span>
        <SparkBars values={spark} className="h-13 gap-1.5" />
      </div>
    </div>
  );
}
