'use client';

import { useEffect, useRef, useState } from 'react';
import { flowActionUrl } from '@/lib/challengeActions';
import { Coins, Loader2 } from 'lucide-react';
import { vitrineFontVars } from '@/components/vitrine/fonts';

import '@/components/vitrine/vitrine.css';
import '@/components/vitrine/forms-vitrine.css';
import './challenge-editors-vitrine.css';

interface RewardsState {
  pool: number;
  distributed: number;
  remaining: number;
  requiredValidations: number;
  cpPerValidation: number;
  breakdown: { userId: string; userName: string; points: number }[];
}

/**
 * Admin-side pool summary for a validation challenge — pool/distributed/remaining and who earned what.
 *
 * Rendu dans le tiroir de challenge et dans la vue de pilotage, qui n'est pas
 * une vitrine : la racine porte sa propre `.vitrine-embed` et les polices de
 * la maquette, comme `ValidationTargetsEditor`.
 */
export function ValidationRewardsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [data, setData] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    fetch(flowActionUrl(challengeId, 'rewards'))
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className={`vitrine-embed ${vitrineFontVars}`}>
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" /> Loading…
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className={`vitrine-embed ${vitrineFontVars}`}>
      <div className="v-section">
        <p className="v-label">
          <Coins /> CP pool
        </p>
        <p className="v-figure">
          <span className="v-figure-value">{data.remaining.toLocaleString()}</span>
          <span className="v-figure-unit">/ {data.pool.toLocaleString()} CP</span>
        </p>
        <p className="v-help" data-size="xs">
          Remaining — {data.cpPerValidation} CP each side of {data.requiredValidations}.
        </p>
        {data.breakdown.length > 0 && (
          <div className="v-ce-split">
            {data.breakdown.map(b => (
              <div key={b.userId} className="v-ce-split-row">
                <span>{b.userName}</span>
                <span>{b.points} CP</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
