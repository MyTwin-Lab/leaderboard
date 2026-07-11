'use client';

import { useState, useEffect } from 'react';
import { Github, CheckCircle2, AlertCircle, Loader2, Link2, Unlink } from 'lucide-react';

interface GithubStatus {
  connected: boolean;
  org: string | null;
  connected_at: string | null;
}

interface Props {
  initialError?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  no_org_admin:
    'The connected account has no organization where you are an admin or owner. An organization account is required.',
  csrf: 'Connection attempt expired or was tampered with. Please try again.',
  exchange_failed: 'Failed to obtain GitHub token. Please try again.',
};

export function GitHubConnectionCard({ initialError }: Props) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? initialError) : null
  );

  useEffect(() => {
    fetch('/api/github-oauth/status')
      .then(r => r.json())
      .then((data: GithubStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, org: null, connected_at: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/github-oauth/connection', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ connected: false, org: null, connected_at: null });
        setError(null);
      }
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    window.location.href = '/api/github-oauth/authorize';
  }

  const connectedAt = status?.connected_at
    ? new Date(status.connected_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <div className="animate-fade-up space-y-8 py-2">

      {/* ── Section header ── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Link2 className="h-3.5 w-3.5" />
          Integrations
        </h2>

        {/* ── GitHub card ── */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">

          {/* Card header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
              <Github className="h-4 w-4 text-white/50" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white/80">GitHub</p>
              <p className="text-[11px] text-white/30">Organization connection</p>
            </div>
            <div className="ml-auto flex-shrink-0">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/20" />
              ) : status?.connected ? (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Connected
                </span>
              ) : (
                <span className="text-[11px] text-white/20">Not connected</span>
              )}
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-4 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-400" />
                <p className="text-[11px] leading-relaxed text-red-400">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="h-10 rounded-lg bg-white/[0.02] animate-pulse" />
            ) : status?.connected ? (
              <>
                {/* Connection details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/30">Organization</span>
                    <span className="font-medium text-white/70">{status.org}</span>
                  </div>
                  {connectedAt && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-white/30">Connected</span>
                      <span className="text-white/40">{connectedAt}</span>
                    </div>
                  )}
                </div>

                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 text-[12px] text-white/25 hover:text-red-400 disabled:opacity-40 transition-colors"
                >
                  {disconnecting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Unlink className="h-3 w-3" />
                  }
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] leading-relaxed text-white/30">
                  Connect a GitHub org admin account to enable repository operations — branch creation, commit tracking, and PR management.
                </p>

                {/* Connect button */}
                <button
                  onClick={handleConnect}
                  className="group w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-all hover:border-brandCP/40 hover:bg-brandCP/[0.06] focus-visible:outline-none"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                    <Github className="h-3.5 w-3.5 text-white/40 group-hover:text-brandCP/80 transition-colors" />
                  </div>
                  <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                    Connect with GitHub
                  </span>
                  <span className="ml-auto text-[11px] text-white/15 group-hover:text-brandCP/60 transition-colors">
                    →
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
