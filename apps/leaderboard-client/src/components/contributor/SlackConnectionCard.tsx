'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

interface SlackStatus {
  connected: boolean;
  team_name: string | null;
  connected_at: string | null;
}

export function SlackConnectionCard() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botToken, setBotToken] = useState('');

  useEffect(() => {
    fetch('/api/slack/status')
      .then(r => r.json())
      .then((data: SlackStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, team_name: null, connected_at: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/slack/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save credentials');
        return;
      }
      setStatus({ connected: true, team_name: data.team_name ?? null, connected_at: new Date().toISOString() });
      setBotToken('');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/slack/connection', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ connected: false, team_name: null, connected_at: null });
        setError(null);
      }
    } finally {
      setDisconnecting(false);
    }
  }

  const connectedAt = status?.connected_at
    ? new Date(status.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const connected = Boolean(status?.connected);

  return (
    <IntegrationCard
      name="Slack"
      description="Discussion signals in challenge channels: answers, unblocks, reviews. Needs a Slack app with channels:read, channels:history, users:read and users:read.email — installed, then invited to the channels to track."
      loading={loading}
      connected={connected}
      error={error}
      details={[
        ...(status?.team_name ? [{ label: 'Workspace', value: status.team_name }] : []),
        ...(connectedAt ? [{ label: 'Connected', value: connectedAt }] : []),
      ]}
      form={
        <input
          className="v-pro-input"
          type="password"
          value={botToken}
          onChange={e => setBotToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Bot token (xoxb-…)"
          autoComplete="new-password"
        />
      }
      action={
        connected
          ? {
              label: disconnecting ? 'Disconnecting…' : 'Disconnect',
              onClick: handleDisconnect,
              busy: disconnecting,
              quiet: true,
            }
          : {
              label: saving ? 'Verifying…' : 'Connect',
              onClick: handleSave,
              busy: saving,
              disabled: !botToken.trim(),
            }
      }
    />
  );
}
