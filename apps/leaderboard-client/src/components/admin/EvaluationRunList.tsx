'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface EvaluationRun {
  uuid: string;
  challenge_id: string;
  trigger_type: string;
  status: string;
  window_start: string;
  window_end: string;
  started_at?: string;
  finished_at?: string;
  error_code?: string;
  meta?: {
    contributionCount?: number;
    durationMs?: number;
  };
}

interface Challenge {
  uuid: string;
  title: string;
}

interface EvaluationRunListProps {
  runs: EvaluationRun[];
  challenges: Challenge[];
  onViewDetail: (runId: string) => void;
  onRetry: (runId: string) => void;
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EvaluationRunList({ runs, challenges, onViewDetail, onRetry }: EvaluationRunListProps) {
  const getChallengeTitle = (challengeId: string) => {
    const challenge = challenges.find(c => c.uuid === challengeId);
    return challenge?.title || challengeId.slice(0, 8);
  };

  const columns = [
    {
      key: 'challenge',
      header: 'Challenge',
      render: (run: EvaluationRun) => (
        <div className="font-medium">{getChallengeTitle(run.challenge_id)}</div>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (run: EvaluationRun) => (
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
          {run.trigger_type}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (run: EvaluationRun) => <StatusBadge status={run.status} />,
      width: '120px',
    },
    {
      key: 'started',
      header: 'Started',
      render: (run: EvaluationRun) => (
        <span className="text-white/70">{formatDate(run.started_at)}</span>
      ),
      width: '130px',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (run: EvaluationRun) => (
        <span className="text-white/70">{formatDuration(run.meta?.durationMs)}</span>
      ),
      width: '90px',
    },
    {
      key: 'contributions',
      header: 'Contribs',
      render: (run: EvaluationRun) => (
        <span className="font-medium text-brandCP">
          {run.meta?.contributionCount ?? '-'}
        </span>
      ),
      width: '80px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (run: EvaluationRun) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onViewDetail(run.uuid)}>
            👁️
          </Button>
          {(run.status === 'failed' || run.status === 'succeeded') && (
            <Button size="sm" variant="secondary" onClick={() => onRetry(run.uuid)}>
              🔄
            </Button>
          )}
        </div>
      ),
      width: '100px',
    },
  ];

  return <Table data={runs} columns={columns} emptyMessage="No evaluation runs found" />;
}
