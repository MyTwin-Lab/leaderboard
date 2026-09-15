'use client';

import { useEffect, useState } from 'react';
import { Info, X, Loader2 } from 'lucide-react';
import { flowSlots } from '@/distribution/mytwin.client';
import type { RulesChallenge } from '@/lib/flowSlots';

interface RewardRulesDrawerProps {
  challengeId: string;
  open: boolean;
  onClose: () => void;
}

export function RewardRulesDrawer({ challengeId, open, onClose }: RewardRulesDrawerProps) {
  const [challenge, setChallenge] = useState<RulesChallenge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07]">
              <Info className="h-3.5 w-3.5 text-white/50" />
            </div>
            <h2 className="text-sm font-semibold text-white">Reward rules</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-xs text-white/35">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : !challenge || !Rules ? (
            <p className="py-8 text-center text-xs text-white/35">Could not load this challenge&apos;s rules.</p>
          ) : (
            <Rules challenge={challenge} />
          )}
        </div>
      </div>
    </>
  );
}
