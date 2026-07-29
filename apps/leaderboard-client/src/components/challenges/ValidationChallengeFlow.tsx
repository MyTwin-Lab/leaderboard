'use client';

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { ValidationOutputViewer } from './ValidationOutputViewer';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  submitterAvatarUrl: string | null;
  alreadyValidatedByMe: boolean;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
}

export function ValidationChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContributionId, setActiveContributionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets ?? []);
        setPool(data.pool ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <ShieldCheck className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No submission exposed for validation yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {pool && pool.pool > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-brandCP/60" />
              <span className="text-sm font-semibold text-brandCP">{pool.remaining.toLocaleString()} CP</span>
              <span className="text-xs text-white/35">left — {pool.cpPerValidation} CP per first-time validation</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            challengeId={challengeId}
            expanded={activeContributionId === t.contributionId}
            onToggle={() => setActiveContributionId(activeContributionId === t.contributionId ? null : t.contributionId)}
            onValidated={fetchData}
          />
        ))}
      </div>
    </div>
  );
}

function TargetCard({
  target,
  challengeId,
  expanded,
  onToggle,
  onValidated,
}: {
  target: TargetItem;
  challengeId: string;
  expanded: boolean;
  onToggle: () => void;
  onValidated: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; contentType: string; cpAwarded: number; alreadyValidated: boolean } | null>(null);

  const runValidation = async (file: File) => {
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('contribution_id', target.contributionId);
      form.append('file', file);
      const res = await fetch(`/api/challenges/${challengeId}/validate`, { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Validation failed');
        return;
      }
      const blob = await res.blob();
      const cpAwarded = Number(res.headers.get('x-validation-cp-awarded') ?? 0);
      setResult({
        blob,
        contentType: res.headers.get('content-type') ?? 'text/plain',
        cpAwarded,
        alreadyValidated: res.headers.get('x-validation-already-validated') === 'true',
      });
      if (cpAwarded > 0) onValidated();
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runValidation(file);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        {target.alreadyValidatedByMe && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Validated by you
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.06] p-4 animate-fade-up">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? 'border-brandCP/60 bg-brandCP/[0.06]' : 'border-white/15 bg-white/[0.01]'
            }`}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-brandCP" />
            ) : (
              <UploadCloud className="h-6 w-6 text-white/25" />
            )}
            <p className="text-xs text-white/40">
              {uploading ? 'Calling the API…' : 'Drop a file here to test this submission'}
            </p>
            <label className="cursor-pointer text-xs font-medium text-brandCP underline">
              or browse
              <input
                type="file"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) runValidation(f); }}
              />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.cpAwarded > 0 && (
                <p className="text-xs font-semibold text-brandCP">+{result.cpAwarded} CP earned</p>
              )}
              <ValidationOutputViewer blob={result.blob} contentType={result.contentType} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
