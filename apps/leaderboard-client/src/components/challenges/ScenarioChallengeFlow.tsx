'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Coins, ListOrdered, MonitorSmartphone } from 'lucide-react';
import { ScenarioWalkthroughScreen } from './ScenarioWalkthroughScreen';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  endpointUrl: string | null;
  walkthroughCount?: number;
  myWalkthrough?: { runId: string; completedAt: string | null } | null;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
}

interface ScenarioStep { id: string; position: number; title: string }

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
}

type TargetState = 'mine' | 'completed' | 'in_progress' | 'never_started';

// La garde serveur couvre le porteur ET tous les membres de son groupe ; côté
// client on ne connaît que le porteur via submitterUserId, donc l'affichage
// « Not eligible » ne se déclenche que dans ce cas précis. Un co-membre du
// groupe verra un bouton actif et essuiera un 403 explicite du serveur s'il
// insiste — c'est la bonne répartition du travail : le serveur décide,
// l'interface se contente d'anticiper le cas courant.
function stateOf(target: TargetItem, currentUserId: string | null): TargetState {
  if (currentUserId && target.submitterUserId === currentUserId) return 'mine';
  if (target.myWalkthrough?.completedAt) return 'completed';
  if (target.myWalkthrough) return 'in_progress';
  return 'never_started';
}

/**
 * L'entrée du validateur en mode scénario : le pool restant, les applications
 * exposées avec mon état sur chacune, et le scénario lui-même en résumé.
 *
 * Le pool est affiché avant le travail, pas après : un pool épuisé se voit
 * avant de parcourir sept étapes, pas au moment de conclure.
 */
export function ScenarioChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TargetItem | null>(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setError('');
    try {
      const [targetsRes, stepsRes] = await Promise.all([
        fetch(`/api/challenges/${challengeId}/validation-targets`),
        fetch(`/api/challenges/${challengeId}/validation-scenario-steps`),
      ]);
      // 401 is not "nothing exposed" — say so explicitly rather than falling
      // through to the empty state, which would read as "nothing to validate".
      if (targetsRes.status === 401) {
        setError('Sign in to see the applications waiting for validation.');
      } else if (!targetsRes.ok) {
        setError('Could not load the applications');
      } else {
        const d = await targetsRes.json();
        setTargets(d.targets ?? []);
        setPool(d.pool ?? null);
        setCurrentUserId(d.currentUserId ?? null);
      }
      if (stepsRes.ok) {
        const d = await stepsRes.json();
        setSteps(d.steps ?? []);
      }
    } catch {
      // fetch() rejects (network failure, CORS, abort) rather than resolving
      // ok:false — without this, loading would never clear.
      setError('Could not load the applications');
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (active) {
    return (
      <ScenarioWalkthroughScreen
        challengeId={challengeId}
        contributionId={active.contributionId}
        submitterName={active.submitterName}
        endpointUrl={active.endpointUrl}
        onClose={() => { setActive(null); fetchData(); }}
      />
    );
  }

  if (targets.length === 0) {
    return (
      <div className="space-y-4">
        {error ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
            <MonitorSmartphone className="h-7 w-7 text-white/15" />
            <p className="text-xs text-white/25">No application exposed for validation yet</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      {pool && pool.pool > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-brandCP/[0.22] bg-white/[0.02] px-5 py-4">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: fgAt(1) }}>
                {pool.remaining.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-brandCP">CP left</span>
            </div>
            <span className="text-xs" style={{ color: fgAt(0.35) }}>
              {pool.cpPerValidation} CP for each completed walkthrough, clamped to what is left.
            </span>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-brandCP/10 px-3.5 py-2 text-xs font-semibold text-brandCP">
            <Coins className="h-3.5 w-3.5" />
            {steps.length} {steps.length === 1 ? 'step' : 'steps'} per application
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {targets.map(t => {
          const state = stateOf(t, currentUserId);
          const isMine = state === 'mine';
          const cta = state === 'completed' ? 'Review' : state === 'in_progress' ? 'Resume' : isMine ? 'Not eligible' : 'Start';
          const badge =
            state === 'completed' ? { label: `Completed · ${pool?.cpPerValidation ?? 0} CP`, cls: 'bg-green-500/15 text-green-400' }
            : state === 'in_progress' ? { label: 'In progress', cls: 'bg-amber-500/15 text-amber-400' }
            : isMine ? { label: 'Your own application', cls: 'bg-white/[0.06]' }
            : { label: 'Never started', cls: 'bg-white/[0.06]' };

          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-4 rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-5 py-4"
              style={{ opacity: isMine ? 0.6 : 1 }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brandCP/10 text-[13px] font-bold text-brandCP">
                {initialsOf(t.submitterName)}
              </div>
              <div className="min-w-0 flex-1 basis-64 space-y-1">
                <span className="block text-[15px] font-semibold" style={{ color: fgAt(0.85) }}>{t.submitterName}</span>
                {t.endpointUrl && (
                  <a
                    href={t.endpointUrl}
                    target="_blank"
                    rel="ugc noreferrer noopener"
                    className="block truncate font-mono text-xs text-brandCP/70 hover:text-brandCP"
                  >
                    {t.endpointUrl}
                  </a>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`} style={badge.cls.includes('text-') ? undefined : { color: fgAt(0.45) }}>
                  {badge.label}
                </span>
                <span className="text-[11px]" style={{ color: fgAt(0.3) }}>
                  {t.walkthroughCount ?? 0} {(t.walkthroughCount ?? 0) === 1 ? 'walkthrough' : 'walkthroughs'} in total
                </span>
              </div>
              <button
                onClick={() => setActive(t)}
                disabled={isMine}
                title={isMine ? 'You cannot walk through your own application' : undefined}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-brandCP/10 px-4 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25 disabled:hover:bg-white/[0.04]"
              >
                {cta}
                {!isMine && state !== 'completed' && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>

      {steps.length > 0 && (
        <div className="space-y-3 rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>
            <ListOrdered className="h-3.5 w-3.5" />
            The scenario
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal" style={{ color: fgAt(0.4) }}>
              {steps.length} {steps.length === 1 ? 'step' : 'steps'} · same for every application
            </span>
          </p>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-baseline gap-2.5">
                <span className="font-mono text-[11px]" style={{ color: fgAt(0.3) }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[13px]" style={{ color: fgAt(0.6) }}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
