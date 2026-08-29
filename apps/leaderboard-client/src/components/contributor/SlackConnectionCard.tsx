'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Unlink, Key } from 'lucide-react';

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

  // Slack logo as SVG
  const SlackLogo = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          <SlackLogo />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">Slack</p>
          <p className="text-[11px] text-white/30">Bot token connection</p>
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
                <span className="text-white/30">Workspace</span>
                <span className="font-medium text-white/70">{status.team_name ?? '—'}</span>
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
              Connect a Slack bot to detect contribution signals in challenge channels. Create a Slack app with the scopes <code className="text-white/40">channels:read</code>, <code className="text-white/40">channels:history</code>, <code className="text-white/40">users:read</code> and <code className="text-white/40">users:read.email</code>, install it to your workspace, then paste its bot token below. Remember to invite the bot to the channels you want to track.
            </p>

            <input
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Bot token (xoxb-…)"
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
            />

            <button
              onClick={handleSave}
              disabled={saving || !botToken.trim()}
              className="group w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-all hover:border-brandCP/40 hover:bg-brandCP/[0.06] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brandCP/60" />
                  : <Key className="h-3.5 w-3.5 text-white/40 group-hover:text-brandCP/80 transition-colors" />
                }
              </div>
              <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                {saving ? 'Verifying & saving…' : 'Save bot token'}
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
