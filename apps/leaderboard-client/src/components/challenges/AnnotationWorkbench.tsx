'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, SkipForward, Sparkles, Tag } from 'lucide-react';
import { flowActionUrl } from '@/lib/challengeActions';

interface AnnotationCard {
  claim_id: string;
  image_url: string | null;
  options: { key: string; label: string }[];
  expires_at: string | null;
}

interface AnnotationProgress {
  labeled: number;
  cp_earned: number;
  quality_score: number | null;
  sensitive_cleared: boolean;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

async function errorOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`;
}

/**
 * L'écran de l'annotateur : une image à la fois, les réponses en boutons, un
 * « passer ». Le serveur choisit l'image ; l'écran ne sait jamais s'il s'agit
 * d'un cas de contrôle.
 */
export function AnnotationWorkbench({ challengeId, isMember }: { challengeId: string; isMember: boolean }) {
  const [card, setCard] = useState<AnnotationCard | null>(null);
  const [empty, setEmpty] = useState(false);
  const [progress, setProgress] = useState<AnnotationProgress | null>(null);
  const [session, setSession] = useState({ labels: 0, cp: 0 });
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    const res = await fetch(flowActionUrl(challengeId, 'progress'));
    if (res.ok) setProgress(await res.json());
  }, [challengeId]);

  const drawNext = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(flowActionUrl(challengeId, 'draw'), { method: 'POST' });
      if (!res.ok) {
        setError(await errorOf(res));
        return;
      }
      const body = (await res.json()) as { claim: AnnotationCard | null };
      setCard(body.claim);
      setEmpty(!body.claim);
    } finally {
      setBusy(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (isMember) void loadProgress();
  }, [isMember, loadProgress]);

  const start = async () => {
    setStarted(true);
    await drawNext();
  };

  const submit = async (value: string) => {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(flowActionUrl(challengeId, `claims/${card.claim_id}/label`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok && res.status !== 409 && res.status !== 410) {
        setError(await errorOf(res));
        return;
      }
      if (res.ok) {
        const body = (await res.json()) as { cp_awarded: number };
        setSession(s => ({ labels: s.labels + 1, cp: s.cp + body.cp_awarded }));
      }
    } finally {
      setBusy(false);
    }
    // 409 / 410 : la réclamation n'est plus active, on passe simplement à la suivante.
    await Promise.all([drawNext(), loadProgress()]);
  };

  const skip = async () => {
    if (!card) return;
    setBusy(true);
    try {
      await fetch(flowActionUrl(challengeId, `claims/${card.claim_id}/release`), { method: 'POST' });
    } finally {
      setBusy(false);
    }
    await drawNext();
  };

  if (!isMember) {
    return (
      <p className="py-6 text-sm" style={{ color: fgAt(0.45) }}>
        Join the challenge to start labeling.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[18px] border border-white/10 bg-white/[0.02] px-4 py-3 text-xs" style={{ color: fgAt(0.5) }}>
        <span>
          <b style={{ color: fgAt(0.85) }}>{progress?.labeled ?? 0}</b> labeled
        </span>
        <span>
          <b style={{ color: fgAt(0.85) }}>{progress?.cp_earned ?? 0}</b> CP earned
        </span>
        <span title="Accuracy on hidden quality checks, updated with a delay">
          Quality score{' '}
          <b style={{ color: fgAt(0.85) }}>
            {progress?.quality_score == null ? '—' : `${Math.round(progress.quality_score * 100)}%`}
          </b>
        </span>
        {started && (
          <span className="ml-auto">
            This session: {session.labels} labels · {session.cp} CP
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2 text-xs text-red-300">{error}</p>
      )}

      {!started ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <Tag className="h-6 w-6" style={{ color: fgAt(0.4) }} />
          <p className="max-w-md text-sm" style={{ color: fgAt(0.6) }}>
            You label one image at a time. Some images are hidden quality checks: your accuracy on them weights your pay.
          </p>
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-2 rounded-xl bg-brandCP px-5 py-2.5 text-sm font-semibold text-black"
          >
            <Sparkles className="h-4 w-4" /> Start labeling
          </button>
        </div>
      ) : empty ? (
        <p className="rounded-[18px] border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm" style={{ color: fgAt(0.55) }}>
          Nothing left to label for you right now. Come back later.
        </p>
      ) : !card ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs" style={{ color: fgAt(0.4) }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the next image…
        </div>
      ) : (
        <div className="space-y-4 rounded-[18px] border border-white/10 bg-white/[0.02] p-4">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- images hébergées ailleurs, tailles arbitraires
            <img
              src={card.image_url}
              alt="Item to label"
              referrerPolicy="no-referrer"
              className="mx-auto max-h-[60vh] w-auto rounded-xl bg-black/40 object-contain"
            />
          ) : (
            <p className="py-10 text-center text-sm" style={{ color: fgAt(0.45) }}>This item has no image.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {card.options.map(option => (
              <button
                key={option.key}
                type="button"
                disabled={busy}
                onClick={() => submit(option.key)}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium transition hover:border-brandCP/50 disabled:opacity-40"
                style={{ color: 'var(--foreground)' }}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={skip}
              className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs disabled:opacity-40"
              style={{ color: fgAt(0.5) }}
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
