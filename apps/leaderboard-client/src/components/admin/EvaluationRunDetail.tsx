'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table } from '@/components/ui/Table';

interface EvaluationRun {
  uuid: string;
  challenge_id: string;
  trigger_type: string;
  trigger_payload?: Record<string, unknown>;
  status: string;
  window_start: string;
  window_end: string;
  started_at?: string;
  finished_at?: string;
  error_code?: string;
  error_message?: string;
  meta?: {
    contributionCount?: number;
    durationMs?: number;
    evaluatorVersion?: string;
  };
}

interface Challenge {
  uuid: string;
  title: string;
}

interface RunContribution {
  runContribution: {
    uuid: string;
    status: string;
    notes?: { skipReason?: string };
    created_at: string;
  };
  contribution: {
    uuid: string;
    title: string;
    type: string;
  } | null;
  user: {
    uuid: string;
    full_name: string;
    github_username: string;
  } | null;
}

interface EvaluationRunDetailProps {
  runId: string;
  onClose: () => void;
  onRetry: (runId: string) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('fr-FR');
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function EvaluationRunDetail({ runId, onClose, onRetry }: EvaluationRunDetailProps) {
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [contributions, setContributions] = useState<RunContribution[]>([]);
  const [stats, setStats] = useState<{ contributionCounts: Record<string, number>; totalContributions: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRunDetail();
    fetchContributions();
  }, [runId]);

  const fetchRunDetail = async () => {
    try {
      const res = await fetch(`/api/admin/evaluation-runs/${runId}`);
      const data = await res.json();
      setRun(data.run);
      setChallenge(data.challenge);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching run detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContributions = async () => {
    try {
      const res = await fetch(`/api/admin/evaluation-runs/${runId}/contributions`);
      const data = await res.json();
      setContributions(data.contributions || []);
    } catch (error) {
      console.error('Error fetching contributions:', error);
    }
  };

  const contributionColumns = [
    {
      key: 'title',
      header: 'Contribution',
      render: (item: RunContribution) => (
        <div>
          <div className="font-medium">{item.contribution?.title || 'Unknown'}</div>
          <div className="text-xs text-white/50">{item.contribution?.type}</div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (item: RunContribution) => (
        <div>
          <div>{item.user?.full_name || '-'}</div>
          <div className="text-xs text-white/50">@{item.user?.github_username}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: RunContribution) => <StatusBadge status={item.runContribution.status} />,
      width: '120px',
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (item: RunContribution) => (
        <span className="text-xs text-white/60">
          {item.runContribution.notes?.skipReason || '-'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  const canRetry = run.status === 'failed' || run.status === 'succeeded';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Run Details
              </h2>
              <p className="text-sm text-white/60">
                {challenge?.title || run.challenge_id.slice(0, 8)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canRetry && (
                <Button variant="secondary" size="sm" onClick={() => onRetry(run.uuid)}>
                  🔄 Retry
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 p-6">
            {/* Status & Meta */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="mb-1 text-xs text-white/60">Status</div>
                <StatusBadge status={run.status} />
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="mb-1 text-xs text-white/60">Trigger</div>
                <div className="text-sm font-medium text-white">{run.trigger_type}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="mb-1 text-xs text-white/60">Duration</div>
                <div className="text-sm font-medium text-white">{formatDuration(run.meta?.durationMs)}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="mb-1 text-xs text-white/60">Contributions</div>
                <div className="text-sm font-medium text-brandCP">{stats?.totalContributions ?? '-'}</div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-medium text-white">Timeline</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Window Start:</span>
                  <span className="ml-2 text-white">{formatDate(run.window_start)}</span>
                </div>
                <div>
                  <span className="text-white/60">Window End:</span>
                  <span className="ml-2 text-white">{formatDate(run.window_end)}</span>
                </div>
                <div>
                  <span className="text-white/60">Started At:</span>
                  <span className="ml-2 text-white">{formatDate(run.started_at)}</span>
                </div>
                <div>
                  <span className="text-white/60">Finished At:</span>
                  <span className="ml-2 text-white">{formatDate(run.finished_at)}</span>
                </div>
              </div>
            </div>

            {/* Error Section */}
            {run.status === 'failed' && run.error_message && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <h3 className="mb-2 text-sm font-medium text-red-400">Error</h3>
                <div className="mb-1 text-xs text-red-400/70">
                  Code: {run.error_code || 'UNKNOWN'}
                </div>
                <div className="text-sm text-red-300">{run.error_message}</div>
              </div>
            )}

            {/* Contribution Stats */}
            {stats?.contributionCounts && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Contribution Status</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.contributionCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="text-sm text-white/70">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contributions Table */}
            {contributions.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-white">Contributions ({contributions.length})</h3>
                <div className="rounded-lg border border-white/10 bg-white/5">
                  <Table 
                    data={contributions.map(c => ({ ...c, uuid: c.runContribution.uuid }))} 
                    columns={contributionColumns} 
                    emptyMessage="No contributions" 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
