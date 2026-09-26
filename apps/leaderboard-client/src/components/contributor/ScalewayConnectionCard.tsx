'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

interface ScalewayStatus {
  connected: boolean;
  project_id: string | null;
  connected_at: string | null;
}

export function ScalewayConnectionCard() {
  const [status, setStatus] = useState<ScalewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [zone, setZone] = useState('fr-par-2');

  useEffect(() => {
    fetch('/api/scaleway/status')
      .then(r => r.json())
      .then((data: ScalewayStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, project_id: null, connected_at: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/scaleway/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_key: secretKey.trim(), project_id: projectId.trim(), zone: zone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save credentials');
        return;
      }
      setStatus({ connected: true, project_id: projectId.trim(), connected_at: new Date().toISOString() });
      setSecretKey('');
      setProjectId('');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/scaleway/connection', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ connected: false, project_id: null, connected_at: null });
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
      name="Scaleway"
      description="GPU compute for training and validation runs, billed to your own project."
      loading={loading}
      connected={connected}
      error={error}
      details={[
        ...(status?.project_id ? [{ label: 'Project', value: status.project_id }] : []),
        ...(connectedAt ? [{ label: 'Connected', value: connectedAt }] : []),
      ]}
      form={
        <div className="v-pro-int-form">
          <input
            className="v-pro-input"
            type="password"
            value={secretKey}
            onChange={e => setSecretKey(e.target.value)}
            placeholder="Secret key"
            autoComplete="new-password"
          />
          <input
            className="v-pro-input"
            type="text"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            placeholder="Project ID"
            autoComplete="off"
          />
          <input
            className="v-pro-input"
            type="text"
            value={zone}
            onChange={e => setZone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Zone (fr-par-2)"
            autoComplete="off"
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
              disabled: !secretKey.trim() || !projectId.trim() || !zone.trim(),
            }
      }
    />
  );
}
