'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Video, AlignLeft, CalendarDays, Clock, Loader2, CheckCircle2, Plus } from 'lucide-react';

interface CreateMeetingDrawerProps {
  open: boolean;
  onClose: () => void;
  challengeId: string;
  onCreated: () => void;
}

// Helper for muted foreground color
function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

// Combine date string + time string → ISO datetime
function toISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// Default end time = start + 1h
function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function CreateMeetingDrawer({ open, onClose, challengeId, onCreated }: CreateMeetingDrawerProps) {
  const today = new Date().toISOString().split('T')[0];
  const defaultStart = '10:00';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(addHour(defaultStart));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Decouple visual state from prop so the CSS transition has a starting frame
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      setTimeout(() => titleRef.current?.focus(), 80);
      setSuccess(false);
      setError('');
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Animate out before calling onClose
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate(today);
    setStartTime(defaultStart);
    setEndTime(addHour(defaultStart));
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    // Auto-advance end time to maintain at least 1h gap
    const [sh, sm] = value.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setEndTime(addHour(value));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date) { setError('Date is required.'); return; }
    const startISO = toISO(date, startTime);
    const endISO = toISO(date, endTime);
    if (new Date(endISO) <= new Date(startISO)) {
      setError('End time must be after start time.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/sync-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          challenge_id: challengeId,
          start_time: startISO,
          end_time: endISO,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          resetForm();
          onCreated();
          handleClose();
        }, 900);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create meeting');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              <Plus className="h-4 w-4 text-brandCP" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>New meeting</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            style={{ color: fgAt(0.3) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Title */}
          <div className="space-y-1.5">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Meeting title…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06]" />
          </div>

          {/* Date */}
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
            />
          </Field>

          {/* Time */}
          <Field icon={<Clock className="h-3.5 w-3.5" />} label="Time">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>Start</p>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => handleStartTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
              <span className="mt-5 text-sm" style={{ color: fgAt(0.2) }}>→</span>
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>End</p>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
            </div>
          </Field>

          {/* Description */}
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description (optional)">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Agenda, context, links…"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] resize-none leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          {/* Google Calendar note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
            <Video className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brandCP/50" />
            <p className="text-xs leading-relaxed" style={{ color: fgAt(0.35) }}>
              A Google Meet link will be automatically generated and sent to all team members via Google Calendar.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400 animate-slide-in">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={handleClose}
            className="text-sm transition-colors"
            style={{ color: fgAt(0.35) }}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving || success}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
              ${success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-brandCP/20 text-brandCP hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)]'
              }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {success && <CheckCircle2 className="h-4 w-4" />}
            {success ? 'Created!' : saving ? 'Creating…' : 'Create meeting'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}
