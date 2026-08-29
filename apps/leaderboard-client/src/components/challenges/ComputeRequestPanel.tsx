'use client';

import { useEffect, useRef, useState } from 'react';
import { Cpu, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface ComputeRequestData {
  id: string;
  status: 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed';
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  ready_at: string | null;
  expired_at: string | null;
  error_message: string | null;
}

const STATUS_LABEL: Record<ComputeRequestData['status'], string> = {
  pending: 'Pending approval',
  approved: 'Approved — creating instance',
  provisioning: 'Setting up your environment…',
  ready: 'Ready',
  rejected: 'Rejected',
  expired: 'Expired',
  failed: 'Creation failed, contact an admin',
};

const STATUS_VARIANT: Record<ComputeRequestData['status'], 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  pending: 'warning',
  approved: 'info',
  provisioning: 'info',
  ready: 'success',
  rejected: 'danger',
  expired: 'muted',
  failed: 'danger',
};

const NON_TERMINAL: ComputeRequestData['status'][] = ['pending', 'approved', 'provisioning'];

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0h00';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

/** Contributor-facing GPU compute request button/status — visible only on ML challenges once Scaleway is connected. */
export function ComputeRequestPanel({ challengeId }: { challengeId: string }) {
  const [scalewayConnected, setScalewayConnected] = useState<boolean | null>(null);
  const [computeEnabled, setComputeEnabled] = useState<boolean | null>(null);
  const [request, setRequest] = useState<ComputeRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [, forceTick] = useState(0);

  const load = () => {
    fetch(`/api/challenges/${challengeId}/compute-request`)
      .then(res => (res.ok ? res.json() : { request: null }))
      .then(d => setRequest(d.request ?? null));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/scaleway/status').then(r => (r.ok ? r.json() : { connected: false })),
      fetch(`/api/challenges/${challengeId}`).then(r => (r.ok ? r.json() : { compute_enabled: false })),
    ])
      .then(([status, challenge]) => {
        setScalewayConnected(!!status.connected);
        setComputeEnabled(!!challenge.compute_enabled);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  useEffect(() => {
    if (scalewayConnected && computeEnabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalewayConnected, computeEnabled, challengeId]);

  useEffect(() => {
    if (!request || !NON_TERMINAL.includes(request.status)) return;
    const interval = setInterval(load, 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status]);

  // Recompute the "expires in XhYY" countdown from expires_at client-side,
  // without re-polling the server every minute just for a label.
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (request?.status !== 'ready' || !request.expires_at) return;
    countdownRef.current = setInterval(() => forceTick(t => t + 1), 60000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [request?.status, request?.expires_at]);

  const handleRequest = async () => {
    setRequesting(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/compute-request`, { method: 'POST' });
      if (res.ok) {
        setConfirming(false);
        load();
      } else {
        const d = await res.json();
        setError(d.error === 'already_requested' ? 'You already made a request on this challenge.' : (d.error ?? 'Request failed'));
      }
    } catch {
      setError('Network error');
    } finally {
      setRequesting(false);
    }
  };

  const handleOpen = async () => {
    setOpening(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/compute-request/reveal-token`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Unable to retrieve the access token');
        return;
      }
      const url = d.jupyter_url ? `${d.jupyter_url}?token=${encodeURIComponent(d.token)}` : '';
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpening(false);
    }
  };

  if (loading) return null;

  // Unlike the global Scaleway-disconnected case below, a challenge with the
  // per-challenge toggle off shows nothing at all — the manager deliberately
  // chose not to offer this on this challenge, there is nothing to explain.
  if (!computeEnabled) return null;

  // Not masked entirely per SPEC §4.1.4 — the contributor sees a clear
  // explanation of why the feature isn't available yet, rather than nothing.
  if (!scalewayConnected) {
    return (
      <div className="flex items-center gap-2.5 rounded-[16px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: 'color-mix(in srgb, var(--foreground) 35%, transparent)' }}>
        <Cpu className="h-3.5 w-3.5 shrink-0" />
        GPU compute power isn&apos;t available yet — the service hasn&apos;t been connected by an administrator.
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-brandCP/[0.18] bg-white/[0.02] p-4 space-y-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Cpu className="h-4 w-4 text-brandCP/80" />
        <h3 className="text-sm font-semibold text-white">GPU compute power</h3>
        {request && <Badge label={STATUS_LABEL[request.status]} variant={STATUS_VARIANT[request.status]} />}
      </div>

      {!request && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/25"
        >
          Request compute power
        </button>
      )}

      {!request && confirming && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-white/50">
            Only one request is possible on this challenge. Once approved by the manager, the instance
            is available for 24h before automatic shutdown — no exception or extension.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:opacity-40"
            >
              {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm request'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={requesting}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-white/50 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {request?.status === 'ready' && (
        <div className="space-y-2">
          {request.expires_at && (
            <p className="text-xs text-white/40">Expires in {formatRemaining(request.expires_at)}</p>
          )}
          <button
            onClick={handleOpen}
            disabled={opening}
            className="flex items-center gap-1.5 rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:opacity-40"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Open my environment <ExternalLink className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
