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
  onDelete: (id: string) => void;
  onSelect: (run: EvaluationRunWithChallenge) => void;
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(d?: Date | string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const triggerLabels: Record<string, string> = {
  manual: 'Manual',
  sync: 'Sync',
  github_pr: 'GitHub PR',
};

export function EvaluationRunList({ runs, onDelete, onSelect }: EvaluationRunListProps) {
  const columns = [
    {
      key: 'challenge',
      header: 'Challenge',
      render: (run: EvaluationRunWithChallenge) => (
        <div>
          <div className="font-medium text-white truncate max-w-[200px]">
            {run.challengeTitle ?? <span className="text-white/30 italic font-mono text-xs">{run.challenge_id.slice(0, 8)}…</span>}
          </div>
          <div className="text-xs text-white/30 font-mono">{run.uuid.slice(0, 8)}…</div>
        </div>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (run: EvaluationRunWithChallenge) => (
        <Badge label={triggerLabels[run.trigger_type] ?? run.trigger_type} variant="muted" />
      ),
      width: '100px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (run: EvaluationRunWithChallenge) => <Badge label={run.status} />,
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
      key: 'contributions',
      header: 'Contribs',
      render: (run: EvaluationRunWithChallenge) => (
        <div className="text-sm font-medium text-brandCP">
          {run.meta?.contributionCount ?? <span className="text-white/30">—</span>}
        </div>
      ),
      width: '80px',
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
            disabled
            title="Re-run not available"
          >
            <RefreshCw className="h-3.5 w-3.5" />
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
