'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, Hash, Radio, X } from 'lucide-react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { SIGNAL_ICONS, getSignalIcon } from '@/components/ui/signalIcons';

interface SignalItem {
  uuid: string;
  label: string;
  description?: string;
  reward_cp: number;
  icon?: string | null;
}

interface SlackConfig {
  challenge_id: string;
  channel_id: string;
  channel_name?: string | null;
  last_run_at?: string | null;
  last_error?: string | null;
}

interface SlackChannel {
  id: string;
  name: string;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Slack channel + contribution signals for a challenge, embedded in the edit
 * drawer. Like tasks, everything is independent CRUD: channel choice and each
 * signal hit the API immediately, not on the challenge's "Save changes".
 */
export function ChallengeSlackSignalsEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [slackConnected, setSlackConnected] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [config, setConfig] = useState<SlackConfig | null>(null);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [rewardCp, setRewardCp] = useState(5);
  const [icon, setIcon] = useState('lightbulb');
  const [adding, setAdding] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Refetch each time the drawer opens (avoids showing stale state).
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchAll();
  }, [open]);

  const fetchSignals = async () => {
    const res = await fetch(`/api/challenges/${challengeId}/signals`);
    if (res.ok) {
      const data = await res.json();
      setSignals(Array.isArray(data) ? data : []);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const statusRes = await fetch('/api/slack/status');
      const status = statusRes.ok ? await statusRes.json() : { connected: false };
      setSlackConnected(!!status.connected);
      if (!status.connected) return;

      await Promise.all([
        fetchSignals(),
        fetch(`/api/challenges/${challengeId}/slack-config`).then(r => r.ok && r.json()).then(d => {
          setConfig(d ?? null);
        }),
        fetch('/api/slack/channels').then(r => r.ok && r.json()).then(d => {
          if (Array.isArray(d)) setChannels(d);
        }),
      ]);
    } catch {} finally { setLoading(false); }
  };

  const handleChannelChange = async (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    setSavingChannel(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/slack-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, channel_name: channel?.name ?? null }),
      });
      if (res.ok) setConfig(await res.json());
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to save channel'); }
    } catch { setError('Network error'); }
    finally { setSavingChannel(false); }
  };

  const handleRemoveChannel = async () => {
    setSavingChannel(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/slack-config`, { method: 'DELETE' });
      if (res.ok) setConfig(null);
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to remove channel'); }
    } catch { setError('Network error'); }
    finally { setSavingChannel(false); }
  };

  const handleAdd = async () => {
    if (!label.trim()) { setError('Signal label is required.'); return; }
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || undefined,
          reward_cp: rewardCp,
          icon,
        }),
      });
      if (res.ok) {
        setLabel('');
        setDescription('');
        setRewardCp(5);
        setIcon('lightbulb');
        await fetchSignals();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add signal');
      }
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/signals/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchSignals();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to delete signal'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  const channelOptions = channels.map(c => ({ value: c.id, label: `#${c.name}` }));

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <Radio className="h-3.5 w-3.5" />
        Discussion signals
        {signals.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {signals.length}
          </span>
        )}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : slackConnected === false ? (
        <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
          Connect Slack in Integrations first to track discussion signals.
        </p>
      ) : (
        <>
          {/* Channel */}
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>
              <Hash className="h-3 w-3" />
              Slack channel
            </p>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SelectDropdown
                  options={channelOptions}
                  value={config?.channel_id ?? ''}
                  onChange={handleChannelChange}
                />
              </div>
              {savingChannel && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: fgAt(0.35) }} />}
              {config && !savingChannel && (
                <button
                  onClick={handleRemoveChannel}
                  className="shrink-0 rounded-md p-1 text-white/25 transition-all hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Remove channel"
                  title="Stop tracking this channel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {config?.last_error ? (
              <p className="text-[11px] text-red-400/80">Last run failed: {config.last_error}</p>
            ) : config?.last_run_at ? (
              <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
                Last checked {new Date(config.last_run_at).toLocaleString()}
              </p>
            ) : config ? (
              <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
                Messages are analyzed once a day.
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
                Pick the channel where this challenge is discussed.
              </p>
            )}
          </div>

          {/* Existing signals */}
          {signals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No signal yet. Define what counts as a contribution in the discussion — each detection rewards the author.
            </p>
          ) : (
            <div className="space-y-1.5">
              {signals.map(signal => {
                const SignalIcon = getSignalIcon(signal.icon);
                return (
                <div key={signal.uuid} className="group flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <SignalIcon className="mt-0.5 h-4 w-4 shrink-0 text-brandCP/70" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ color: fgAt(0.75) }}>{signal.label}</span>
                    {signal.description && (
                      <span className="block truncate text-[11px]" style={{ color: fgAt(0.3) }}>{signal.description}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-brandCP">+{signal.reward_cp} CP</span>
                  <button
                    onClick={() => handleDelete(signal.uuid)}
                    disabled={deletingId === signal.uuid}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                    aria-label="Delete signal"
                  >
                    {deletingId === signal.uuid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                );
              })}
            </div>
          )}

          {/* Add form */}
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {/* Icon picker */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SIGNAL_ICONS).map(([key, entry]) => {
                const Icon = entry.icon;
                const active = icon === key;
                return (
                  <button
                    key={key}
                    onClick={() => setIcon(key)}
                    title={entry.label}
                    aria-label={entry.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                      active
                        ? 'border-brandCP/40 bg-brandCP/10 text-brandCP'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/15 hover:text-white/60'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="New signal label…"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                style={{ color: 'var(--foreground)' }}
              />
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={rewardCp}
                  onChange={e => setRewardCp(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
                <span className="text-[10px] font-semibold text-brandCP">CP</span>
              </div>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe when this signal applies — this definition is what the AI uses to detect it…"
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                disabled={adding || !label.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
