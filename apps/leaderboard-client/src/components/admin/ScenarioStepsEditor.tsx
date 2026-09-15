'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ListOrdered, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { flowActionUrl } from '@/lib/challengeActions';

interface StepItem {
  id: string;
  position: number;
  title: string;
  instructions: string | null;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Le scénario d'un challenge de validation en mode scénario : la liste
 * ordonnée d'étapes que chaque validateur parcourra sur chaque application
 * exposée.
 *
 * Passe en lecture seule dès qu'une walkthrough existe — le serveur renvoie
 * `frozen`, donc l'éditeur l'affiche sans avoir à tenter une écriture pour
 * l'apprendre. Même geste que le bouton de suppression déjà désactivé sur un
 * target qui porte des verdicts.
 */
export function ScenarioStepsEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftInstructions, setDraftInstructions] = useState('');
  const [error, setError] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchSteps();
  }, [open]);

  const fetchSteps = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(flowActionUrl(challengeId, 'scenario-steps'));
      if (res.ok) {
        const d = await res.json();
        setSteps(d.steps ?? []);
        setFrozen(!!d.frozen);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load the scenario');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch(flowActionUrl(challengeId, 'scenario-steps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instructions: draftInstructions.trim() || null }),
      });
      if (res.ok) {
        setDraftTitle('');
        setDraftInstructions('');
        await fetchSteps();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add the step');
      }
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  };

  const patchStep = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(flowActionUrl(challengeId, `scenario-steps/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) await fetchSteps();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to update the step'); }
    } catch { setError('Network error'); }
    finally { setBusyId(null); }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(flowActionUrl(challengeId, `scenario-steps/${id}`), { method: 'DELETE' });
      if (res.ok) await fetchSteps();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to delete the step'); }
    } catch { setError('Network error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <ListOrdered className="h-3.5 w-3.5" />
        The scenario
        {steps.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {steps.length} {steps.length === 1 ? 'step' : 'steps'} · same for every application
          </span>
        )}
      </p>

      {frozen && (
        <div className="flex items-start gap-2 rounded-[16px] border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-300/90">
            The scenario is frozen — a walkthrough has already started. Editing, reordering or deleting a step
            would make the walkthroughs incomparable.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {steps.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No step yet. A validator cannot start a walkthrough until the scenario has at least one.
            </p>
          ) : (
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={s.id} className="group flex items-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 font-mono text-[11px]" style={{ color: fgAt(0.3) }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-sm font-medium" style={{ color: fgAt(0.8) }}>{s.title}</span>
                    {s.instructions && (
                      <span className="block text-[11px] leading-relaxed" style={{ color: fgAt(0.4) }}>{s.instructions}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => patchStep(s.id, { position: i - 1 })}
                      disabled={frozen || i === 0 || busyId === s.id}
                      aria-label="Move step up"
                      className="rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => patchStep(s.id, { position: i + 1 })}
                      disabled={frozen || i === steps.length - 1 || busyId === s.id}
                      aria-label="Move step down"
                      className="rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(s.id)}
                      disabled={frozen || busyId === s.id}
                      title={frozen ? 'The scenario is frozen - a walkthrough has already started' : undefined}
                      aria-label="Delete step"
                      className="rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/25"
                    >
                      {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {frozen ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-3 text-xs" style={{ color: fgAt(0.25) }}>
              Add a step — disabled while the scenario is frozen
            </p>
          ) : (
            <div className="space-y-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>
                Add a step
              </p>
              <input
                type="text"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Create an account"
                disabled={adding}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none disabled:opacity-50"
              />
              <textarea
                rows={2}
                value={draftInstructions}
                onChange={e => setDraftInstructions(e.target.value)}
                placeholder="Optional - the detail of the instruction"
                disabled={adding}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !draftTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brandCP/10 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-brandCP/10"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add step
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
