'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, Hash, Radio, X } from 'lucide-react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { SIGNAL_ICONS, getSignalIcon } from '@/components/ui/signalIcons';
import { extensionActionUrl } from '@/lib/challengeActions';

/** Le canal et les signaux passent par les actions de l'extension slack-signals. */
const SLACK_SIGNALS = 'slack-signals';

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

/**
 * Slack channel + contribution signals for a challenge, embedded in the edit
 * drawer. Like tasks, everything is independent CRUD: channel choice and each
 * signal hit the API immediately, not on the challenge's "Save changes".
 *
 * Sur le vocabulaire commun des tiroirs (`forms-vitrine.css`).
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
    const res = await fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, 'signals'));
    if (res.ok) {
      const data = await res.json();
      setSignals(Array.isArray(data) ? data : []);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const statusRes = await fetch('/api/integrations/slack/status');
      const status = statusRes.ok ? await statusRes.json() : { connected: false };
      setSlackConnected(!!status.connected);
      if (!status.connected) return;

      await Promise.all([
        fetchSignals(),
        fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, 'config')).then(r => r.ok && r.json()).then(d => {
          setConfig(d ?? null);
        }),
        fetch('/api/integrations/slack/extras/channels').then(r => r.ok && r.json()).then(d => {
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
      const res = await fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, 'config'), {
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
      const res = await fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, 'config'), { method: 'DELETE' });
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
      const res = await fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, 'signals'), {
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
      const res = await fetch(extensionActionUrl(challengeId, SLACK_SIGNALS, `signals/${id}`), { method: 'DELETE' });
      if (res.ok) await fetchSignals();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to delete signal'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  const channelOptions = channels.map(c => ({ value: c.id, label: `#${c.name}` }));

  return (
    <div className="v-field">
      <p className="v-label">
        <Radio />
        Discussion signals
        {signals.length > 0 && <span className="v-badge">{signals.length}</span>}
      </p>

      {loading ? (
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" /> Loading…
        </div>
      ) : slackConnected === false ? (
        <p className="v-alert" data-tone="info">
          Connect Slack in Integrations first to track discussion signals.
        </p>
      ) : (
        <>
          {/* Channel */}
          <div className="v-field">
            <p className="v-label">
              <Hash />
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
              {savingChannel && <Loader2 className="v-spin h-3.5 w-3.5 shrink-0" style={{ color: 'var(--v-subtle)' }} />}
              {config && !savingChannel && (
                <button
                  type="button"
                  onClick={handleRemoveChannel}
                  className="v-btn-icon"
                  data-tone="danger"
                  aria-label="Remove channel"
                  title="Stop tracking this channel"
                >
                  <X />
                </button>
              )}
            </div>
            {config?.last_error ? (
              <p className="v-field-error">Last run failed: {config.last_error}</p>
            ) : config?.last_run_at ? (
              <p className="v-help" data-size="xs">
                Last checked {new Date(config.last_run_at).toLocaleString()}
              </p>
            ) : config ? (
              <p className="v-help" data-size="xs">
                Messages are analyzed once a day.
              </p>
            ) : (
              <p className="v-help" data-size="xs">
                Pick the channel where this challenge is discussed.
              </p>
            )}
          </div>

          {/* Existing signals */}
          {signals.length === 0 ? (
            <p className="v-alert" data-tone="info">
              No signal yet. Define what counts as a contribution in the discussion - each detection rewards the author.
            </p>
          ) : (
            <div className="v-rows">
              {signals.map(signal => {
                const SignalIcon = getSignalIcon(signal.icon);
                return (
                  <div key={signal.uuid} className="v-row">
                    <SignalIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--v-accent)' }} />
                    <div className="v-row-text">
                      <span className="v-row-title">{signal.label}</span>
                      {signal.description && <span className="v-row-meta truncate">{signal.description}</span>}
                    </div>
                    <span className="v-badge" data-tone="accent">+{signal.reward_cp} CP</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(signal.uuid)}
                      disabled={deletingId === signal.uuid}
                      className="v-btn-icon"
                      data-tone="danger"
                      aria-label="Delete signal"
                    >
                      {deletingId === signal.uuid ? <Loader2 className="v-spin" /> : <Trash2 />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add form */}
          <div className="v-section">
            {/* Icon picker */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SIGNAL_ICONS).map(([key, entry]) => {
                const Icon = entry.icon;
                const active = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    title={entry.label}
                    aria-label={entry.label}
                    className="v-btn-quiet v-btn-sm"
                    data-on={active ? 'true' : 'false'}
                  >
                    <Icon />
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
                className="v-input min-w-0 flex-1"
              />
              <div className="v-num shrink-0">
                <input
                  type="number"
                  min={0}
                  value={rewardCp}
                  onChange={e => setRewardCp(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span className="v-num-unit">CP</span>
              </div>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe when this signal applies - this definition is what the AI uses to detect it…"
              rows={2}
              className="v-textarea"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !label.trim()}
                className="v-btn v-btn-sm"
              >
                {adding ? <Loader2 className="v-spin" /> : <Plus />}
                Add
              </button>
            </div>
          </div>
        </>
      )}

      {error && <p className="v-alert">{error}</p>}
    </div>
  );
}
