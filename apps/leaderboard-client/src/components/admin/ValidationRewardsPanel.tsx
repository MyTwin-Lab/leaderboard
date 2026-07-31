'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';

interface RewardsState {
  pool: number;
  distributed: number;
  remaining: number;
  requiredValidations: number;
  cpPerValidation: number;
  breakdown: { userId: string; userName: string; points: number }[];
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/** Admin-side pool summary for a validation challenge — pool/distributed/remaining and who earned what. */
export function ValidationRewardsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [data, setData] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}/validation-rewards`)
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <Coins className="h-3.5 w-3.5" /> CP pool
      </p>
      <p className="text-sm" style={{ color: fgAt(0.75) }}>
        {data.remaining.toLocaleString()} / {data.pool.toLocaleString()} CP remaining
        <span className="ml-1 text-xs" style={{ color: fgAt(0.35) }}>
          ({data.cpPerValidation} CP each side of {data.requiredValidations})
        </span>
      </p>
      {data.breakdown.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.breakdown.map(b => (
            <div key={b.userId} className="flex items-center justify-between text-xs" style={{ color: fgAt(0.5) }}>
              <span className="truncate">{b.userName}</span>
              <span className="shrink-0 font-medium" style={{ color: fgAt(0.7) }}>{b.points} CP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
