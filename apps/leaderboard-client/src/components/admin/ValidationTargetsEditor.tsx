'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';

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
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Which api_packaging submissions from the linked ML challenge are exposed on
 * this validation challenge. Like tasks and Slack signals, this is
 * independent CRUD — each add/remove hits the API immediately, not on the
 * challenge's "Save changes".
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
        fetch(`/api/challenges/${challengeId}/validation-targets`),
        fetch(`/api/challenges/${challengeId}/validation-targets?eligible=true`),
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
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`, {
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
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets/${targetId}`, { method: 'DELETE' });
      if (res.ok) await fetchAll();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to remove'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <ShieldCheck className="h-3.5 w-3.5" />
        Exposed submissions
        {targets.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {targets.length}
          </span>
        )}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {targets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No submission exposed yet. Add one below.
            </p>
          ) : (
            <div className="space-y-1.5">
              {targets.map(t => (
                <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ color: fgAt(0.75) }}>{t.submitterName}</span>
                    <span className="block text-[10px]" style={{ color: fgAt(0.35) }}>
                      {t.outcome === 'pending'
                        ? (t.worksCount !== undefined
                            ? `${t.verdictCount} votes (${t.worksCount} Fonctionne, ${t.brokenCount} Défectueux)`
                            : `${t.verdictCount} votes`)
                        : `${t.outcome === 'works' ? '✅ Fonctionne' : '❌ Défectueux'} (${t.verdictCount} votes)`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(t.id)}
                    disabled={deletingId === t.id || t.verdictCount > 0}
                    title={t.verdictCount > 0 ? 'Ce target a déjà reçu des votes — impossible de le retirer' : undefined}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/25"
                    aria-label="Remove submission"
                  >
                    {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {eligible.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>
                Eligible — pick a submission and enter its endpoint
              </p>
              {eligible.map(e => {
                const url = urlDrafts[e.contributionId] ?? '';
                const isAdding = addingId === e.contributionId;
                return (
                  <div key={e.contributionId} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="w-28 shrink-0 truncate text-xs text-white/60">{e.userName}</span>
                    <input
                      type="url"
                      value={url}
                      onChange={ev => setUrlDrafts(d => ({ ...d, [e.contributionId]: ev.target.value }))}
                      onKeyDown={ev => ev.key === 'Enter' && handleAdd(e.contributionId)}
                      placeholder="https://your-model.example.com/predict"
                      disabled={isAdding}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleAdd(e.contributionId)}
                      disabled={isAdding || !url.trim()}
                      title="Add as validation target"
                      className="shrink-0 rounded-md p-1.5 text-brandCP/60 transition-all hover:bg-brandCP/10 hover:text-brandCP disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
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
