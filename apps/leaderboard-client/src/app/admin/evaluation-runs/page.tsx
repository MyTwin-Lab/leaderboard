'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EvaluationRunList } from '@/components/admin/EvaluationRunList';
import { EvaluationRunDetail } from '@/components/admin/EvaluationRunDetail';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { EvaluationRun, Challenge } from '../../../../../../packages/database-service/domain/entities';

interface EvaluationRunWithChallenge extends EvaluationRun {
  challengeTitle?: string;
}

const STATUS_OPTIONS = ['pending', 'running', 'succeeded', 'failed', 'canceled'] as const;

const statusCounts = (runs: EvaluationRunWithChallenge[]) => {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    counts[run.status] = (counts[run.status] ?? 0) + 1;
  }
  return counts;
};

export default function EvaluationRunsPage() {
  const [runs, setRuns] = useState<EvaluationRunWithChallenge[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<EvaluationRunWithChallenge | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  const fetchRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (selectedChallengeId) params.set('challengeId', selectedChallengeId);
      if (selectedStatus) params.set('status', selectedStatus);

      const res = await fetch(`/api/evaluation-runs?${params}`);
      const data: EvaluationRun[] = await res.json();

      // Enrich with challenge titles
      const enriched = data.map((run) => ({
        ...run,
        challengeTitle: challenges.find((c) => c.uuid === run.challenge_id)?.title,
      }));
      setRuns(enriched);
    } catch {
      toast('Failed to load evaluation runs', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedChallengeId, selectedStatus, challenges]);

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then(setChallenges)
      .catch(() => setChallenges([]));
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [selectedChallengeId, selectedStatus, challenges]);

  const handleRetry = async (run: EvaluationRunWithChallenge) => {
    const ok = await confirm({
      title: 'Re-run Evaluation',
      message: `Re-launch the sync evaluation for "${run.challengeTitle ?? 'this challenge'}"?`,
      confirmLabel: 'Re-run',
    });
    if (!ok) return;

    setRetryingId(run.uuid);
    try {
      const res = await fetch(`/api/evaluation-runs/${run.uuid}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast(`Evaluation re-launched — ${data.count} contributions processed`, 'success');
        await fetchRuns();
      } else {
        toast(data.error ?? 'Failed to re-run evaluation', 'error');
      }
    } catch {
      toast('Failed to re-run evaluation', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Run',
      message: 'This will permanently delete this evaluation run record.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/evaluation-runs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRuns((prev) => prev.filter((r) => r.uuid !== id));
        toast('Run deleted', 'success');
      } else {
        toast('Failed to delete run', 'error');
      }
    } catch {
      toast('Failed to delete run', 'error');
    }
  };

  const counts = statusCounts(runs);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(selectedStatus === s ? '' : s)}
              className={`rounded-lg border p-3 text-left transition-all ${
                selectedStatus === s
                  ? 'border-brandCP/30 bg-brandCP/5'
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="mb-1 text-xl font-bold text-white">{counts[s] ?? 0}</div>
              <Badge label={s} />
            </button>
          ))}
        </div>

        {/* Table */}
        <Card
          title="Evaluation Runs"
          count={runs.length}
          action={
            <div className="flex items-center gap-2">
              <select
                value={selectedChallengeId}
                onChange={(e) => setSelectedChallengeId(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brandCP"
              >
                <option value="">All challenges</option>
                {challenges.map((c) => (
                  <option key={c.uuid} value={c.uuid}>{c.title}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brandCP"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          }
        >
          <EvaluationRunList
            runs={runs}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onSelect={setSelectedRun}
            retryingId={retryingId}
          />
        </Card>
      </div>

      {selectedRun && (
        <EvaluationRunDetail
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-white/5" />)}
      </div>
      <div className="h-10 rounded-md bg-white/5" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-md bg-white/5" />)}
    </div>
  );
}
