'use client';

import { X, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EvaluationRun } from '../../../../../packages/database-service/domain/entities';

interface EvaluationRunWithChallenge extends EvaluationRun {
  challengeTitle?: string;
}

interface EvaluationRunDetailProps {
  run: EvaluationRunWithChallenge;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/40 shrink-0 w-36">{label}</span>
      <span className="text-sm text-white text-right">{children}</span>
    </div>
  );
}

function formatDate(d?: Date | string) {
  if (!d) return <span className="text-white/25 italic">—</span>;
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(ms?: number) {
  if (!ms) return <span className="text-white/25 italic">—</span>;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const statusIcons: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle className="h-4 w-4 text-green-400" />,
  failed: <AlertCircle className="h-4 w-4 text-red-400" />,
  running: <Clock className="h-4 w-4 text-yellow-400 animate-pulse" />,
  pending: <Clock className="h-4 w-4 text-white/40" />,
  canceled: <X className="h-4 w-4 text-white/40" />,
};

export function EvaluationRunDetail({ run, onClose }: EvaluationRunDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0f0f1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {statusIcons[run.status]}
            <h3 className="text-base font-semibold text-white">Run Details</h3>
            <Badge label={run.status} />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-2">
          <Row label="Run ID">
            <span className="font-mono text-xs text-white/60">{run.uuid}</span>
          </Row>
          <Row label="Challenge">
            {run.challengeTitle ?? <span className="font-mono text-xs text-white/40">{run.challenge_id}</span>}
          </Row>
          <Row label="Trigger">
            <Badge label={run.trigger_type} variant="muted" />
          </Row>
          <Row label="Window">
            <span className="font-mono text-xs">
              {new Date(run.window_start).toLocaleDateString('fr-FR')} → {new Date(run.window_end).toLocaleDateString('fr-FR')}
            </span>
          </Row>
          <Row label="Started at">{formatDate(run.started_at)}</Row>
          <Row label="Finished at">{formatDate(run.finished_at)}</Row>
          <Row label="Duration">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-brandCP" />
              {formatDuration(run.meta?.durationMs)}
            </span>
          </Row>
          <Row label="Contributions">
            {run.meta?.contributionCount !== undefined
              ? <span className="font-medium text-brandCP">{run.meta.contributionCount}</span>
              : <span className="text-white/25 italic">—</span>}
          </Row>
          {run.meta?.evaluatorVersion && (
            <Row label="Evaluator version">
              <span className="font-mono text-xs text-white/60">{run.meta.evaluatorVersion}</span>
            </Row>
          )}
          {run.meta?.gridVersion && (
            <Row label="Grid version">
              <span className="font-mono text-xs text-white/60">v{run.meta.gridVersion}</span>
            </Row>
          )}
        </div>

        {/* Error block */}
        {run.status === 'failed' && (run.error_code || run.error_message) && (
          <div className="mx-5 mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            {run.error_code && (
              <div className="mb-1 text-xs font-mono font-medium text-red-400">{run.error_code}</div>
            )}
            {run.error_message && (
              <p className="text-xs text-red-300/70">{run.error_message}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-3 text-right">
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
