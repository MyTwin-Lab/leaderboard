'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

interface OpenAIStatus {
  connected: boolean;
  connected_at: string | null;
}

export function OpenAIConnectionCard() {
  const [status, setStatus] = useState<OpenAIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    fetch('/api/openai/status')
      .then(r => r.json())
      .then((data: OpenAIStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, connected_at: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/openai/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save credentials');
        return;
      }
      setStatus({ connected: true, connected_at: new Date().toISOString() });
      setApiKey('');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/openai/connection', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ connected: false, connected_at: null });
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
      name="OpenAI"
      description="Model access for the evaluator agent: it scores contributions against the challenge's grid."
      loading={loading}
      connected={connected}
      error={error}
      details={connectedAt ? [{ label: 'Connected', value: connectedAt }] : []}
      form={
        <input
          className="v-pro-input"
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="API key (sk-…)"
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
              disabled: !apiKey.trim(),
            }
      }
    />
  );
}
