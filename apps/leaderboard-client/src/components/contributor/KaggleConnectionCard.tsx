'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Unlink, Key } from 'lucide-react';

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

  // Kaggle "K" logo as SVG
  const KaggleLogo = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="currentColor">
      <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.285.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.07.334" />
    </svg>
  );

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          <KaggleLogo />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">Kaggle</p>
          <p className="text-[11px] text-white/30">API key connection</p>
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
                <span className="text-white/30">Username</span>
                <span className="font-medium text-white/70">{status.username}</span>
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
              Connect your Kaggle account to enable dataset and model activity tracking. You can find your API key in your Kaggle account settings.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Kaggle username"
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
              />
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="API key"
                autoComplete="new-password"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !username.trim() || !apiKey.trim()}
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
