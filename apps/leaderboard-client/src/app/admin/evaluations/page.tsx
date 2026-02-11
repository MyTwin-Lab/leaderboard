'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EvaluationRunList } from '@/components/admin/EvaluationRunList';
import { EvaluationRunDetail } from '@/components/admin/EvaluationRunDetail';

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
  error_message?: string;
  meta?: {
    contributionCount?: number;
    durationMs?: number;
  };
}

interface Challenge {
  uuid: string;
  title: string;
}

interface StatusCounts {
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  canceled: number;
}

export default function EvaluationsPage() {
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterChallenge, setFilterChallenge] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    fetchRuns();
    fetchChallenges();
  }, [filterChallenge, filterStatus]);

  const fetchRuns = async () => {
    try {
      const params = new URLSearchParams();
      if (filterChallenge) params.set('challengeId', filterChallenge);
      if (filterStatus) params.set('status', filterStatus);
      
      const res = await fetch(`/api/admin/evaluation-runs?${params}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setStatusCounts(data.summary?.statusCounts || null);
    } catch (error) {
      console.error('Error fetching evaluation runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data || []);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const handleRetry = async (runId: string) => {
    const reason = prompt('Reason for retry:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/evaluation-runs/${runId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`✅ Retry initiated! ${data.evaluationsCount} evaluations.`);
        fetchRuns();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error retrying run:', error);
      alert('Error retrying run');
    }
  };

  const handleViewDetail = (runId: string) => {
    setSelectedRun(runId);
  };

  const handleCloseDetail = () => {
    setSelectedRun(null);
  };

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Summary */}
        {statusCounts && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            <div className="rounded-lg bg-white/5 p-3 sm:p-4">
              <div className="mb-0.5 text-xl font-bold text-yellow-400 sm:mb-1 sm:text-2xl">
                {statusCounts.pending}
              </div>
              <div className="text-xs text-white/60 sm:text-sm">Pending</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 sm:p-4">
              <div className="mb-0.5 text-xl font-bold text-blue-400 sm:mb-1 sm:text-2xl">
                {statusCounts.running}
              </div>
              <div className="text-xs text-white/60 sm:text-sm">Running</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 sm:p-4">
              <div className="mb-0.5 text-xl font-bold text-green-400 sm:mb-1 sm:text-2xl">
                {statusCounts.succeeded}
              </div>
              <div className="text-xs text-white/60 sm:text-sm">Succeeded</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 sm:p-4">
              <div className="mb-0.5 text-xl font-bold text-red-400 sm:mb-1 sm:text-2xl">
                {statusCounts.failed}
              </div>
              <div className="text-xs text-white/60 sm:text-sm">Failed</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 sm:p-4">
              <div className="mb-0.5 text-xl font-bold text-white/40 sm:mb-1 sm:text-2xl">
                {statusCounts.canceled}
              </div>
              <div className="text-xs text-white/60 sm:text-sm">Canceled</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterChallenge}
            onChange={(e) => setFilterChallenge(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
          >
            <option value="">All Challenges</option>
            {challenges.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.title}
              </option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>

          <Button variant="secondary" size="sm" onClick={() => { setFilterChallenge(''); setFilterStatus(''); }}>
            Clear Filters
          </Button>
        </div>

        {/* Runs Table */}
        <Card title="Evaluation Runs" className="rounded-md">
          <EvaluationRunList
            runs={runs}
            challenges={challenges}
            onViewDetail={handleViewDetail}
            onRetry={handleRetry}
          />
        </Card>
      </div>

      {/* Detail Drawer/Modal */}
      {selectedRun && (
        <EvaluationRunDetail
          runId={selectedRun}
          onClose={handleCloseDetail}
          onRetry={handleRetry}
        />
      )}
    </>
  );
}
