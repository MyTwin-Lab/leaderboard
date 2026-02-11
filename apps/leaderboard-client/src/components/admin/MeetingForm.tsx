'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

interface MeetingFormProps {
  challenges: Challenge[];
  onSubmit: (data: {
    title: string;
    description?: string;
    challenge_id: string;
    start_time: string;
    end_time: string;
  }) => void;
  onCancel: () => void;
}

export function MeetingForm({ challenges, onSubmit, onCancel }: MeetingFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || undefined,
      challenge_id: challengeId,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    });
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Weekly sync"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          rows={2}
          placeholder="Optional description..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Challenge *</label>
        <select
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          className={inputClass}
          required
        >
          <option value="">Select a challenge</option>
          {challenges.map((c) => (
            <option key={c.uuid} value={c.uuid}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Start *</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">End *</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Meeting</Button>
      </div>
    </form>
  );
}
