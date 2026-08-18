import { cn } from "@/lib/utils";

interface SparkBarsProps {
  /** Raw counts, oldest → newest. */
  values: number[];
  className?: string;
  barClassName?: string;
}

/** Tiny 7-bar activity chart — the peak bar is solid brandCP, the rest translucent.
 * Shared by the home page's trending challenges and the challenges list card. */
export function SparkBars({ values, className, barClassName }: SparkBarsProps) {
  const max = Math.max(...values, 1);

  return (
    <div className={cn("flex items-end gap-1", className)}>
      {values.map((value, i) => {
        const isPeak = value > 0 && value === max;
        const heightPct = value === 0 ? 6 : Math.max(14, Math.round((value / max) * 100));
        return (
          <div
            key={i}
            className={cn(
              "min-w-0 flex-1 rounded-sm transition-all duration-500",
              isPeak ? "bg-brandCP" : "bg-brandCP/25",
              barClassName
            )}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}
