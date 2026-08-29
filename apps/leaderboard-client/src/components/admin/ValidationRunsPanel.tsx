'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, Loader2, XCircle } from 'lucide-react';
import { ValidationOutputViewer } from '@/components/challenges/ValidationOutputViewer';

interface RunItem {
  id: string;
  contributionId: string;
  submitterName: string;
  validatorId: string;
  validatorName: string;
  verdict: 'works' | 'broken';
  description: string | null;
  createdAt: string;
  fileFilename: string | null;
  fileContentType: string | null;
  responseContentType: string | null;
  responseStatus: number | null;
  purged: boolean;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

function VerdictBadge({ verdict }: { verdict: 'works' | 'broken' }) {
  if (verdict === 'works') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Works
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
      <XCircle className="h-3 w-3" /> Broken
    </span>
  );
}

function RunFile({ challengeId, run }: { challengeId: string; run: RunItem }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/challenges/${challengeId}/validation-runs/${run.id}/file`)
      .then(res => (res.ok ? res.blob() : Promise.reject()))
      .then(b => { if (!cancelled) setBlob(b); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [challengeId, run.id]);

  return <RunFileMedia loading={loading} error={error} blob={blob} run={run} />;
}

function RunFileMedia({ loading, error, blob, run }: { loading: boolean; error: boolean; blob: Blob | null; run: RunItem }) {
  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectUrl]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" style={{ color: fgAt(0.3) }} />;
  if (error || !blob || !objectUrl) return <p className="text-xs" style={{ color: fgAt(0.35) }}>File unavailable</p>;

  const isImage = (run.fileContentType ?? '').startsWith('image/');

  if (isImage) {
    return <img src={objectUrl} alt={run.fileFilename ?? 'file'} className="max-h-64 rounded-lg border border-white/10" />;
  }
  return (
    <a
      href={objectUrl}
      download={run.fileFilename ?? 'file'}
      className="flex w-fit items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:border-white/20"
      style={{ color: fgAt(0.6) }}
    >
      <Download className="h-3.5 w-3.5" /> {run.fileFilename ?? 'Download file'}
    </a>
  );
}

function RunResponse({ challengeId, run }: { challengeId: string; run: RunItem }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch(`/api/challenges/${challengeId}/validation-runs/${run.id}/response`)
      .then(res => (res.ok ? res.blob() : Promise.reject()))
      .then(b => { if (!cancelled) setBlob(b); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [challengeId, run.id]);

  if (error) return <p className="text-xs" style={{ color: fgAt(0.35) }}>Response unavailable</p>;
  if (!blob) return <Loader2 className="h-4 w-4 animate-spin" style={{ color: fgAt(0.3) }} />;
  return <ValidationOutputViewer blob={blob} contentType={run.responseContentType ?? 'text/plain'} />;
}

function RunRow({ challengeId, run }: { challengeId: string; run: RunItem }) {
  const [expanded, setExpanded] = useState(false);
  const showDescription = !!run.description;

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        disabled={run.purged}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.02] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm" style={{ color: fgAt(0.75) }}>{run.validatorName}</span>
          <VerdictBadge verdict={run.verdict} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px]" style={{ color: fgAt(0.3) }}>
            {new Date(run.createdAt).toLocaleString()}
          </span>
          {!run.purged && (
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: fgAt(0.3) }} />
          )}
        </div>
      </button>

      {run.purged ? (
        <p className="border-t border-white/[0.06] px-3 py-2 text-[10px]" style={{ color: fgAt(0.3) }}>
          Content purged (archived challenge)
        </p>
      ) : expanded && (
        <div className="space-y-3 border-t border-white/[0.06] p-3">
          {showDescription && (
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-xs" style={{ color: fgAt(0.6) }}>
              {run.description}
            </p>
          )}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.25) }}>File sent</p>
            <RunFile challengeId={challengeId} run={run} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.25) }}>Endpoint response</p>
            <RunResponse challengeId={challengeId} run={run} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Manager-side review of every validation run: file sent, endpoint response, and description on negative verdicts. */
export function ValidationRunsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}/validation-runs`)
      .then(res => (res.ok ? res.json() : { runs: [] }))
      .then(d => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-[16px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
        No run yet.
      </p>
    );
  }

  const runsByTarget = new Map<string, RunItem[]>();
  for (const run of runs) {
    const list = runsByTarget.get(run.contributionId) ?? [];
    list.push(run);
    runsByTarget.set(run.contributionId, list);
  }

  return (
    <div className="space-y-4">
      {[...runsByTarget.entries()].map(([contributionId, targetRuns]) => (
        <div key={contributionId} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
            {targetRuns[0].submitterName}
          </p>
          <div className="space-y-1.5">
            {targetRuns.map(run => (
              <RunRow key={run.id} challengeId={challengeId} run={run} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
