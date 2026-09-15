'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, Trash2, ChevronRight } from 'lucide-react';
import type { EvaluationRun } from '../../../../../packages/database-service/domain/entities';

interface EvaluationRunWithChallenge extends EvaluationRun {
  challengeTitle?: string;
}

interface EvaluationRunListProps {
  runs: EvaluationRunWithChallenge[];
  onRetry: (run: EvaluationRunWithChallenge) => void;
  onDelete: (id: string) => void;
  onSelect: (run: EvaluationRunWithChallenge) => void;
  retryingId: string | null;
}

function formatDuration(ms?: number) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(d?: Date | string) {
  if (!d) return '-';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Le handler inscrit dans le run (`project`, `submission`, `formative`…). */
export function runHandler(run: EvaluationRun): string | undefined {
  const handler = run.trigger_payload?.handler;
  return typeof handler === 'string' ? handler : undefined;
}

/** Ce qui a été évalué : le challenge, ou à défaut le sujet gardé dans le run (sandbox). */
function subjectLabel(run: EvaluationRunWithChallenge) {
  if (run.challengeTitle) return run.challengeTitle;
  if (run.meta?.subject?.title) return run.meta.subject.title;
  const id = run.challenge_id ?? run.uuid;
  return <span className="text-white/30 italic font-mono text-xs">{id.slice(0, 8)}…</span>;
}

export function EvaluationRunList({ runs, onRetry, onDelete, onSelect, retryingId }: EvaluationRunListProps) {
  const columns = [
    {
      key: 'subject',
      header: 'Subject',
      render: (run: EvaluationRunWithChallenge) => (
        <div>
          <div className="font-medium text-white truncate max-w-[200px]">{subjectLabel(run)}</div>
          <div className="text-xs text-white/30 font-mono">{run.uuid.slice(0, 8)}…</div>
        </div>
      ),
    },
    {
      key: 'flow',
      header: 'Flow',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge label={run.trigger_type} variant="muted" />
          {runHandler(run) && <span className="text-[11px] text-white/35 font-mono">{runHandler(run)}</span>}
        </div>
      ),
      width: '110px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (run: EvaluationRunWithChallenge) => (
        <div title={run.error_message}>
          <Badge label={run.status} />
        </div>
      ),
      width: '110px',
    },
    {
      key: 'started_at',
      header: 'Started',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="text-sm text-white/60">{formatDate(run.started_at)}</div>
      ),
      width: '140px',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="text-sm text-white/60 font-mono">
          {formatDuration(run.meta?.durationMs)}
        </div>
      ),
      width: '90px',
    },
    {
      key: 'grid',
      header: 'Grid',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="text-sm text-white/60 font-mono">
          {run.meta?.gridSlug ?? <span className="text-white/30">-</span>}
        </div>
      ),
      width: '90px',
    },
    {
      key: 'actions',
      header: '',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onSelect(run)} title="View details">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRetry(run)}
            // Seul un run échoué se rejoue : un run réussi a déjà produit ses effets.
            disabled={retryingId === run.uuid || run.status !== 'failed'}
            title={run.status === 'failed' ? 'Re-run evaluation' : 'Only a failed run can be re-run'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retryingId === run.uuid ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(run.uuid)} title="Delete run">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '110px',
    },
  ];

  return <Table data={runs} columns={columns} emptyMessage="No evaluation runs found" />;
}
