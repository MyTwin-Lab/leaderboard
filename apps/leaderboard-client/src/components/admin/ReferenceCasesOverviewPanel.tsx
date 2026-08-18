'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Trash2 } from 'lucide-react';

interface CaseItem {
  id: string;
  authorUserId: string | null;
  inputFilename: string;
  createdAt: string;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Admin/manager oversight of a validation challenge's reference cases —
 * read + moderation-delete only, no authoring here: per the challenge-014
 * SPEC's actor table, only a medical_pro writes cases (see
 * ReferenceCaseAuthorPanel, mounted on the contributor-facing challenge page
 * instead, since ChallengeManageView — where this panel lives — is only
 * reachable by admins/managers, not by a medical_pro who isn't also one).
 */
export function ReferenceCasesOverviewPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const wasOpen = useRef(false);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-reference-cases`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, challengeId]);

  const handleRemove = async (caseId: string) => {
    setDeletingId(caseId);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-reference-cases/${caseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchAll();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to remove');
      }
    } catch {
      setError('Network error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <FileText className="h-3.5 w-3.5" />
        Reference cases
        {cases.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {cases.length}
          </span>
        )}
      </p>

      {cases.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
          No reference case written yet — medical_pro users can write one from the challenge page.
        </p>
      ) : (
        <div className="space-y-1.5">
          {cases.map(c => (
            <div key={c.id} className="group flex items-center gap-2.5 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>{c.inputFilename}</span>
              <button
                onClick={() => handleRemove(c.id)}
                disabled={deletingId === c.id}
                className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20"
                aria-label="Remove reference case"
              >
                {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
