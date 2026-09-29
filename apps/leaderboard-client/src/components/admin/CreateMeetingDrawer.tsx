'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, AlignLeft, CalendarDays, Clock, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { Field } from './challengeFormFields';

import './admin-forms-vitrine.css';

interface CreateMeetingDrawerProps {
  open: boolean;
  onClose: () => void;
  challengeId: string;
  onCreated: () => void;
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

/**
 * Le tiroir « New meeting », sur la coque vitrine (`components/vitrine/Drawer`) :
 * le portail, le fond, Escape et le glissement sont à elle.
 */
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

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 80);
      setSuccess(false);
      setError('');
    }
  }, [open]);

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
          onClose();
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
    <Drawer
      open={open}
      onClose={onClose}
      title="New meeting"
      icon={<Plus />}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="v-btn-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || success}
            className="v-btn"
            data-tone={success ? 'success' : undefined}
          >
            {saving && <Loader2 className="v-spin" />}
            {success && <CheckCircle2 />}
            {success ? 'Created!' : saving ? 'Creating…' : 'Create meeting'}
          </button>
        </>
      }
    >
      {/* Title */}
      <div className="v-af-title">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Meeting title…"
          className="v-bare"
        />
        <div className="v-af-title-line" />
      </div>

      {/* Date */}
      <Field icon={<CalendarDays />} label="Date">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="v-input"
        />
      </Field>

      {/* Time */}
      <Field icon={<Clock />} label="Time">
        <div className="v-af-range">
          <div className="v-field">
            <p className="v-label">Start</p>
            <input
              type="time"
              value={startTime}
              onChange={e => handleStartTimeChange(e.target.value)}
              className="v-input"
            />
          </div>
          <span className="v-af-range-arrow">→</span>
          <div className="v-field">
            <p className="v-label">End</p>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="v-input"
            />
          </div>
        </div>
      </Field>

      {/* Description */}
      <Field icon={<AlignLeft />} label="Description (optional)">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Agenda, context, links…"
          rows={4}
          className="v-textarea"
        />
      </Field>

      {/* Google Calendar note */}
      <div className="v-alert" data-tone="info">
        <Video />
        <span>A Google Meet link will be automatically generated and sent to all team members via Google Calendar.</span>
      </div>

      {/* Error */}
      {error && <p className="v-alert">{error}</p>}
    </Drawer>
  );
}
