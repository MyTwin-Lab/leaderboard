'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

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
  not_admin: 'Only an admin can connect a GitHub account.',
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

  const connected = Boolean(status?.connected);

  return (
    <IntegrationCard
      name="GitHub"
      description="Branches, commits, pull requests and reviews — the repository operations of a code challenge, and what feeds the evaluator."
      loading={loading}
      connected={connected}
      error={error}
      details={[
        ...(status?.org ? [{ label: 'Organization', value: status.org }] : []),
        ...(connectedAt ? [{ label: 'Connected', value: connectedAt }] : []),
      ]}
      action={
        connected
          ? {
              label: disconnecting ? 'Disconnecting…' : 'Disconnect',
              onClick: handleDisconnect,
              busy: disconnecting,
              quiet: true,
            }
          : { label: 'Connect', onClick: handleConnect }
      }
    />
  );
}
