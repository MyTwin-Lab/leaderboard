'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface ComputeRequestItem {
  id: string;
  requesterName: string;
  status: 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed';
  requested_at: string;
  decided_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  error_message: string | null;
}

const STATUS_LABEL: Record<ComputeRequestItem['status'], string> = {
  pending: 'Pending approval',
  rejected: 'Rejected',
  approved: 'Approved — creating instance',
  provisioning: 'Provisioning',
  ready: 'Ready',
  expired: 'Expired',
  failed: 'Creation failed',
};

const STATUS_VARIANT: Record<ComputeRequestItem['status'], 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  pending: 'warning',
  rejected: 'danger',
  approved: 'info',
  provisioning: 'info',
  ready: 'success',
  expired: 'muted',
  failed: 'danger',
};

// Statuses that still change on their own (waiting on the manager's
// decision or on the provisioning/expiration crons) — keeps the manager's
// view live without a full re-fetch-on-every-render.
const NON_TERMINAL: ComputeRequestItem['status'][] = ['pending', 'approved', 'provisioning'];

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

function RequestRow({ challengeId, item, onChanged }: { challengeId: string; item: ComputeRequestItem; onChanged: () => void }) {
  const [acting, setActing] = useState<'approve' | 'reject' | 'retry' | null>(null);

  async function decide(decision: 'approve' | 'reject' | 'retry') {
    setActing(decision);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/compute-requests/${item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) onChanged();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm" style={{ color: fgAt(0.75) }}>{item.requesterName}</span>
          <Badge label={STATUS_LABEL[item.status]} variant={STATUS_VARIANT[item.status]} />
        </div>
        <span className="shrink-0 text-[10px]" style={{ color: fgAt(0.3) }}>
          {new Date(item.requested_at).toLocaleString()}
        </span>
      </div>

      {item.error_message && (
        <p className="mt-1.5 text-[11px]" style={{ color: fgAt(0.4) }}>{item.error_message}</p>
      )}

      {item.status === 'pending' && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => decide('approve')}
            disabled={acting !== null}
            className="rounded-full border border-green-500/20 bg-green-500/[0.07] px-3 py-1 text-[11px] font-semibold text-green-400 disabled:opacity-40"
          >
            {acting === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
          </button>
          <button
            onClick={() => decide('reject')}
            disabled={acting !== null}
            className="rounded-full border border-red-500/20 bg-red-500/[0.07] px-3 py-1 text-[11px] font-semibold text-red-400 disabled:opacity-40"
          >
            {acting === 'reject' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reject'}
          </button>
        </div>
      )}

      {item.status === 'failed' && (
        <div className="mt-2">
          <button
            onClick={() => decide('retry')}
            disabled={acting !== null}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white/70 disabled:opacity-40"
          >
            {acting === 'retry' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Manager-side review of GPU compute requests on an ML challenge — approve/reject/retry, live status. */
export function ComputeRequestsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [requests, setRequests] = useState<ComputeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);

  const load = () => {
    fetch(`/api/challenges/${challengeId}/compute-requests`)
      .then(res => (res.ok ? res.json() : { requests: [] }))
      .then(d => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    load();
  }, [open, challengeId]);

  useEffect(() => {
    if (!open) return;
    if (!requests.some(r => NON_TERMINAL.includes(r.status))) return;
    const interval = setInterval(load, 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, challengeId, requests]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-[16px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
        No compute power request yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map(item => (
        <RequestRow key={item.id} challengeId={challengeId} item={item} onChanged={load} />
      ))}
    </div>
  );
}
