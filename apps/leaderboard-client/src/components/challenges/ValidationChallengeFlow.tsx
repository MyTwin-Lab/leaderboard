'use client';

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, XCircle, Loader2, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { ValidationOutputViewer } from './ValidationOutputViewer';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  submitterAvatarUrl: string | null;
  alreadyValidatedByMe: boolean;
  verdictCount: number;
  outcome: 'pending' | 'works' | 'broken';
  resolvedAt: string | null;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
  requiredValidations: number;
}

export function ValidationChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContributionId, setActiveContributionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets ?? []);
        setPool(data.pool ?? null);
        setCurrentUserId(data.currentUserId ?? null);
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
              <span className="text-xs text-white/35">
                left — {pool.cpPerValidation} CP to each validator on the winning side, once {pool.requiredValidations} verdicts are in
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            requiredValidations={pool?.requiredValidations ?? 0}
            challengeId={challengeId}
            isOwnTarget={!!currentUserId && t.submitterUserId === currentUserId}
            expanded={activeContributionId === t.contributionId}
            onToggle={() => setActiveContributionId(activeContributionId === t.contributionId ? null : t.contributionId)}
            onResolved={fetchData}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ target, requiredValidations }: { target: TargetItem; requiredValidations: number }) {
  if (target.outcome === 'works') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Fonctionne ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  if (target.outcome === 'broken') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Défectueux ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-white/40">
      {target.verdictCount}/{requiredValidations} validations reçues
    </span>
  );
}

function TargetCard({
  target,
  requiredValidations,
  challengeId,
  isOwnTarget,
  expanded,
  onToggle,
  onResolved,
}: {
  target: TargetItem;
  requiredValidations: number;
  challengeId: string;
  isOwnTarget: boolean;
  expanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [output, setOutput] = useState<{ blob: Blob; contentType: string; status: number } | null>(null);
  const [verdict, setVerdict] = useState<'works' | 'broken' | null>(null);
  const [description, setDescription] = useState('');
  const [submittingVerdict, setSubmittingVerdict] = useState(false);
  const [verdictResult, setVerdictResult] = useState<{ resolved: boolean; outcome: string; cpAwarded: number } | null>(null);

  const runValidation = async (file: File) => {
    setUploading(true);
    setError('');
    setLastFile(file);
    setOutput(null);
    setVerdict(null);
    setVerdictResult(null);
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
      const status = Number(res.headers.get('x-validation-status')) || res.status;
      setOutput({ blob, contentType: res.headers.get('content-type') ?? 'text/plain', status });
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  const submitVerdict = async () => {
    if (!verdict || !lastFile || !output) return;
    if (verdict === 'broken' && !description.trim()) {
      setError('A description is required when marking a submission as Défectueux');
      return;
    }
    setSubmittingVerdict(true);
    setError('');
    try {
      const form = new FormData();
      form.append('contribution_id', target.contributionId);
      form.append('verdict', verdict);
      if (description.trim()) form.append('description', description.trim());
      form.append('file', lastFile);
      form.append('response', output.blob, 'response');
      form.append('response_content_type', output.contentType);
      form.append('response_status', String(output.status));
      const res = await fetch(`/api/challenges/${challengeId}/validation-verdicts`, { method: 'POST', body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || 'Failed to submit verdict');
        return;
      }
      setVerdictResult(d);
      onResolved();
    } catch {
      setError('Network error');
    } finally {
      setSubmittingVerdict(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runValidation(file);
  };

  const canVote = !target.alreadyValidatedByMe && !verdictResult;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={isOwnTarget ? undefined : onToggle}
        disabled={isOwnTarget}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${isOwnTarget ? 'cursor-default opacity-50' : 'hover:bg-white/[0.02]'}`}
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        <div className="flex items-center gap-2">
          {isOwnTarget && (
            <span className="text-xs text-white/30">Votre soumission</span>
          )}
          {!isOwnTarget && target.alreadyValidatedByMe && (
            <span className="text-xs text-white/30">Vous avez déjà voté</span>
          )}
          <StatusBadge target={target} requiredValidations={requiredValidations} />
        </div>
      </button>

      {!isOwnTarget && expanded && (
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

          {output && <ValidationOutputViewer blob={output.blob} contentType={output.contentType} />}

          {output && canVote && !verdictResult && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setVerdict('works')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'works' ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ✅ Fonctionne
                </button>
                <button
                  onClick={() => setVerdict('broken')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'broken' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ❌ Défectueux
                </button>
              </div>
              {verdict && (
                <>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={verdict === 'broken' ? 'What went wrong? (required)' : 'Notes (optional)'}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                    rows={2}
                  />
                  <button
                    onClick={submitVerdict}
                    disabled={submittingVerdict || (verdict === 'broken' && !description.trim())}
                    className="w-full rounded-lg bg-brandCP/20 px-3 py-2 text-xs font-medium text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submittingVerdict ? 'Envoi…' : 'Envoyer le verdict'}
                  </button>
                </>
              )}
            </div>
          )}

          {verdictResult && (
            <div className="space-y-1 text-xs">
              {verdictResult.cpAwarded > 0 && (
                <p className="font-semibold text-brandCP">+{verdictResult.cpAwarded} CP earned</p>
              )}
              <p className="text-white/40">
                {verdictResult.resolved
                  ? `Résolu : ${verdictResult.outcome === 'works' ? 'Fonctionne' : 'Défectueux'}`
                  : 'Verdict enregistré — en attente des autres validateurs'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
