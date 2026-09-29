'use client';

import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { flowSlots } from '@/distribution/mytwin.client';
import type { RulesChallenge } from '@/lib/flowSlots';

import './challenge-overlays-vitrine.css';

interface RewardRulesDrawerProps {
  challengeId: string;
  open: boolean;
  onClose: () => void;
}

/** Le tiroir « Reward rules », en lecture : la vue de règles du flow du challenge. */
export function RewardRulesDrawer({ challengeId, open, onClose }: RewardRulesDrawerProps) {
  const [challenge, setChallenge] = useState<RulesChallenge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  // Les règles se lisent avec la vue du flow du challenge.
  const Rules = challenge ? flowSlots(challenge.type).rulesView : null;

  return (
    <Drawer open={open} onClose={onClose} icon={<Info />} title="Reward rules">
      {loading ? (
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" /> Loading…
        </div>
      ) : !challenge || !Rules ? (
        <p className="v-quiet">Could not load this challenge&apos;s rules.</p>
      ) : (
        <Rules challenge={challenge} />
      )}
    </Drawer>
  );
}
