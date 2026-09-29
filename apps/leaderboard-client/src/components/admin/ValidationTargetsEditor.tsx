'use client';

import { useEffect, useRef, useState } from 'react';
import { flowActionUrl } from '@/lib/challengeActions';
import { Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { vitrineFontVars } from '@/components/vitrine/fonts';

import '@/components/vitrine/vitrine.css';
import '@/components/vitrine/forms-vitrine.css';

interface EligibleSubmission {
  contributionId: string;
  userId: string;
  userName: string;
}

interface TargetItem {
  id: string;
  contributionId: string;
  submitterName: string;
  verdictCount: number;
  outcome: 'pending' | 'works' | 'broken';
  worksCount?: number;
  brokenCount?: number;
  // Mode scénario seulement — 0 vote n'y signifie jamais "rien à protéger",
  // c'est walkthroughCount qui porte le travail déjà fait sur cette cible.
  walkthroughCount?: number;
}

/**
 * Which api_packaging submissions from the linked ML challenge are exposed on
 * this validation challenge. Like tasks and Slack signals, this is
 * independent CRUD — each add/remove hits the API immediately, not on the
 * challenge's "Save changes".
 *
 * Rendu dans le tiroir de challenge, mais aussi dans la vue de pilotage
 * (`distribution/client/*-validation.tsx`), qui n'est pas une vitrine : la
 * racine porte donc sa propre `.vitrine-embed`, pour avoir les jetons `--v-*`
 * partout où elle s'affiche, et les polices de la maquette avec (`next/font`
 * est doublé sous Vitest par `test/setup.ts`). Imbriquée dans un tiroir, elle
 * ne change rien.
 */
export function ValidationTargetsEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [eligible, setEligible] = useState<EligibleSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchAll();
  }, [open]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [targetsRes, eligibleRes] = await Promise.all([
        fetch(flowActionUrl(challengeId, 'targets')),
        fetch(flowActionUrl(challengeId, 'targets?eligible=true')),
      ]);
      if (targetsRes.ok) {
        const d = await targetsRes.json();
        setTargets((d.targets ?? []).map((t: any) => ({
          id: t.id,
          contributionId: t.contributionId,
          submitterName: t.submitterName,
          verdictCount: t.verdictCount ?? 0,
          outcome: t.outcome ?? 'pending',
          worksCount: t.worksCount,
          brokenCount: t.brokenCount,
          walkthroughCount: t.walkthroughCount,
        })));
      }
      if (eligibleRes.ok) {
        const d = await eligibleRes.json();
        setEligible(d.eligible ?? []);
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (contributionId: string) => {
    const url = urlDrafts[contributionId]?.trim();
    if (!url) return;
    setAddingId(contributionId);
    setError('');
    try {
      const res = await fetch(flowActionUrl(challengeId, 'targets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contribution_id: contributionId, live_endpoint_url: url }),
      });
      if (res.ok) {
        setUrlDrafts(d => { const next = { ...d }; delete next[contributionId]; return next; });
        await fetchAll();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add');
      }
    } catch { setError('Network error'); }
    finally { setAddingId(null); }
  };

  const handleRemove = async (targetId: string) => {
    setDeletingId(targetId);
    try {
      const res = await fetch(flowActionUrl(challengeId, `targets/${targetId}`), { method: 'DELETE' });
      if (res.ok) await fetchAll();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to remove'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className={`vitrine-embed ${vitrineFontVars} v-field`}>
      <p className="v-label">
        <ShieldCheck />
        Exposed submissions
        {targets.length > 0 && <span className="v-badge">{targets.length}</span>}
      </p>

      {loading ? (
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" /> Loading…
        </div>
      ) : (
        <>
          {targets.length === 0 ? (
            <p className="v-alert" data-tone="info">
              No submission exposed yet. Add one below.
            </p>
          ) : (
            <div className="v-rows">
              {targets.map(t => (
                <div key={t.id} className="v-row">
                  <div className="v-row-text">
                    <span className="v-row-title">{t.submitterName}</span>
                    <span className="v-row-meta">
                      {t.outcome === 'pending'
                        ? (t.worksCount !== undefined
                            ? `${t.verdictCount} votes (${t.worksCount} Works, ${t.brokenCount} Broken)`
                            : `${t.verdictCount} votes`)
                        : `${t.outcome === 'works' ? '✅ Works' : '❌ Broken'} (${t.verdictCount} votes)`}
                    </span>
                  </div>
                  <div className="v-row-actions">
                    <button
                      type="button"
                      onClick={() => handleRemove(t.id)}
                      disabled={deletingId === t.id || t.verdictCount > 0 || !!t.walkthroughCount}
                      title={
                        t.verdictCount > 0
                          ? 'This target already received votes - it cannot be removed'
                          : t.walkthroughCount
                            ? 'This target already has walkthroughs - it cannot be removed'
                            : undefined
                      }
                      className="v-btn-icon"
                      data-tone="danger"
                      aria-label="Remove submission"
                    >
                      {deletingId === t.id ? <Loader2 className="v-spin" /> : <Trash2 />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {eligible.length > 0 && (
            <div className="v-section">
              <p className="v-section-title">
                Eligible - pick a submission and enter its endpoint
              </p>
              <div className="v-rows">
                {eligible.map(e => {
                  const url = urlDrafts[e.contributionId] ?? '';
                  const isAdding = addingId === e.contributionId;
                  return (
                    <div key={e.contributionId} className="v-row" data-quiet="true">
                      <span className="v-row-title w-28 shrink-0 text-xs">{e.userName}</span>
                      <input
                        type="url"
                        value={url}
                        onChange={ev => setUrlDrafts(d => ({ ...d, [e.contributionId]: ev.target.value }))}
                        onKeyDown={ev => ev.key === 'Enter' && handleAdd(e.contributionId)}
                        placeholder="https://your-model.example.com/predict"
                        disabled={isAdding}
                        className="v-input min-w-0 flex-1"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAdd(e.contributionId)}
                        disabled={isAdding || !url.trim()}
                        title="Add as validation target"
                        className="v-btn-icon"
                        aria-label="Add as validation target"
                      >
                        {isAdding ? <Loader2 className="v-spin" /> : <Plus />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="v-alert">{error}</p>
      )}
    </div>
  );
}
