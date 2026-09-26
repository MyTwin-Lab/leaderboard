'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

interface KaggleStatus {
  connected: boolean;
  username: string | null;
  connected_at: string | null;
}

export function KaggleConnectionCard() {
  const [status, setStatus] = useState<KaggleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    fetch('/api/kaggle/status')
      .then(r => r.json())
      .then((data: KaggleStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, username: null, connected_at: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/kaggle/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save credentials');
        return;
      }
      setStatus({ connected: true, username: username.trim(), connected_at: new Date().toISOString() });
      setUsername('');
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
      const res = await fetch('/api/kaggle/connection', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ connected: false, username: null, connected_at: null });
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
      name="Kaggle"
      description="Datasets and model versions for ML challenges. The API key is in your Kaggle account settings."
      loading={loading}
      connected={connected}
      error={error}
      details={[
        ...(status?.username ? [{ label: 'Username', value: status.username }] : []),
        ...(connectedAt ? [{ label: 'Connected', value: connectedAt }] : []),
      ]}
      form={
        <div className="v-pro-int-form">
          <input
            className="v-pro-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Kaggle username"
            autoComplete="off"
          />
          <input
            className="v-pro-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="API key"
            autoComplete="new-password"
          />
        </div>
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
              disabled: !username.trim() || !apiKey.trim(),
            }
      }
    />
  );
}
