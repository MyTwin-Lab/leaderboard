'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Unlink, Key, Cpu } from 'lucide-react';

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

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          <Cpu className="h-4 w-4 text-white/50" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">Scaleway</p>
          <p className="text-[11px] text-white/30">GPU compute connection</p>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/30">Project</span>
                <span className="font-medium text-white/70">{status.project_id}</span>
              </div>
              {connectedAt && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/30">Connected</span>
                  <span className="text-white/40">{connectedAt}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 text-[12px] text-white/25 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        ) : (
          <>
            <p className="text-[12px] leading-relaxed text-white/30">
              Connect a Scaleway account so contributors on ML challenges can request temporary GPU compute power, approved by the challenge manager.
            </p>

            <div className="space-y-2">
              <input
                type="password"
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Secret key"
                autoComplete="new-password"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
              />
              <input
                type="text"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                placeholder="Project ID"
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
              />
              <input
                type="text"
                value={zone}
                onChange={e => setZone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Zone (e.g. fr-par-2)"
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !secretKey.trim() || !projectId.trim() || !zone.trim()}
              className="group w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-all hover:border-brandCP/40 hover:bg-brandCP/[0.06] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brandCP/60" />
                  : <Key className="h-3.5 w-3.5 text-white/40 group-hover:text-brandCP/80 transition-colors" />
                }
              </div>
              <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                {saving ? 'Verifying & saving…' : 'Save credentials'}
              </span>
              {!saving && (
                <span className="ml-auto text-[11px] text-white/15 group-hover:text-brandCP/60 transition-colors">→</span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
