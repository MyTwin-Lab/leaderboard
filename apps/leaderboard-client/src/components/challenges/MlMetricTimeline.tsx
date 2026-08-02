'use client';

import { Target } from 'lucide-react';

interface MlMetricTimelineProps {
  name: string;
  baseline: number;
  /** Best value per contributor, deduplicated and sorted descending — points[0] is the leader. */
  points: number[];
}

/**
 * Places a value on a scale centered on the leader rather than a plain linear
 * scale: [baseline → leader] fills the left half, [leader → 1] the right half.
 * This always leaves visible headroom on both sides of the leader, whatever
 * their actual score — that headroom is the point (it's what invites someone
 * to beat it).
 */
function toPercent(value: number, baseline: number, leader: number): number {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  if (value <= leader) {
    const span = leader - baseline;
    return span <= 0 ? 50 : 50 * clamp((value - baseline) / span);
  }
  const span = 1 - leader;
  return span <= 0 ? 50 : 50 + 50 * clamp((value - leader) / span);
}

export function MlMetricTimeline({ name, baseline, points }: MlMetricTimelineProps) {
  if (points.length === 0) return null;

  const leader = points[0];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/35">
          <Target className="h-3.5 w-3.5 shrink-0 text-brandCP/60" />
          {name.toUpperCase()} to beat
        </span>
        <span className="text-sm font-semibold text-brandCP">{leader.toFixed(3)}</span>
      </div>

      <div className="relative h-3">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.06]" />

        {/* Other contributors */}
        {points.slice(1).map((value, i) => (
          <div
            key={i}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brandCP/40"
            style={{ left: `${toPercent(value, baseline, leader)}%` }}
            title={value.toFixed(3)}
          />
        ))}

        {/* Leader, always centered */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brandCP shadow-[0_0_16px_rgba(10,247,193,0.35)]"
          style={{ left: `${toPercent(leader, baseline, leader)}%` }}
          title={leader.toFixed(3)}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/25">
        <span>{baseline.toFixed(2)}</span>
        <span>1.00</span>
      </div>
    </div>
  );
}
