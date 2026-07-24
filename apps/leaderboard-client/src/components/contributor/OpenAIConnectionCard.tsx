'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Unlink, Key } from 'lucide-react';

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

  // OpenAI logo as SVG
  const OpenAILogo = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          <OpenAILogo />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">OpenAI</p>
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
            {connectedAt && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/30">Connected</span>
                <span className="text-white/40">{connectedAt}</span>
              </div>
            )}
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
              Powers every AI feature: contribution evaluation, meeting analysis and Slack signal detection. Paste an API key from your OpenAI dashboard — it replaces the <code className="text-white/40">OPENAI_API_KEY</code> env var.
            </p>

            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="API key (sk-…)"
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all"
            />

            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="group w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-all hover:border-brandCP/40 hover:bg-brandCP/[0.06] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brandCP/60" />
                  : <Key className="h-3.5 w-3.5 text-white/40 group-hover:text-brandCP/80 transition-colors" />
                }
              </div>
              <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                {saving ? 'Verifying & saving…' : 'Save API key'}
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
