'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';

interface EligibleSubmission {
  contributionId: string;
  userId: string;
  userName: string;
  liveEndpointUrl: string;
}

interface TargetItem {
  id: string;
  contributionId: string;
  submitterName: string;
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
        setTargets((d.targets ?? []).map((t: any) => ({ id: t.id, contributionId: t.contributionId, submitterName: t.submitterName })));
      }
      if (eligibleRes.ok) {
        const d = await eligibleRes.json();
        setEligible(d.eligible ?? []);
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (contributionId: string) => {
    setAddingId(contributionId);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contribution_id: contributionId }),
      });
      if (res.ok) await fetchAll();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to add'); }
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
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>{t.submitterName}</span>
                  <button
                    onClick={() => handleRemove(t.id)}
                    disabled={deletingId === t.id}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
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
                Eligible (has a deployed endpoint, not yet exposed)
              </p>
              {eligible.map(e => (
                <button
                  key={e.contributionId}
                  onClick={() => handleAdd(e.contributionId)}
                  disabled={addingId === e.contributionId}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-brandCP/20 hover:bg-brandCP/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-white/60">{e.userName}</span>
                  {addingId === e.contributionId ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brandCP/50" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0 text-brandCP/60" />
                  )}
                </button>
              ))}
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
