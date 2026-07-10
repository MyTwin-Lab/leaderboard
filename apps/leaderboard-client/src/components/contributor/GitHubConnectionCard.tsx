'use client';

import { useState, useEffect } from 'react';

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
    'The connected GitHub account has no organization where you are an admin or owner. An organization account is required.',
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--foreground)]">GitHub Integration</h3>
        {!loading && status?.connected && (
          <span className="text-xs font-medium text-green-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Connected
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="h-16 rounded-lg bg-[var(--muted)]/30 animate-pulse" />
      ) : status?.connected ? (
        <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <div className="flex justify-between">
            <span>Organization</span>
            <span className="text-[var(--foreground)] font-medium">{status.org}</span>
          </div>
          {connectedAt && (
            <div className="flex justify-between">
              <span>Connected</span>
              <span>{connectedAt}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Connect a GitHub org admin account to enable repository operations (branches, commits, PRs).
        </p>
      )}

      <div className="flex justify-end">
        {status?.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Connect GitHub Account
          </button>
        )}
      </div>
    </div>
  );
}
