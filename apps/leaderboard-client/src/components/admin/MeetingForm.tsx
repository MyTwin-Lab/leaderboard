'use client';

import { useState } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    challenge_id: '',
    start_time: '',
    end_time: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: formData.title,
      description: formData.description || undefined,
      challenge_id: formData.challenge_id,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      <FormSection title="General">
        <FormField label="Title" required>
          <input
            type="text"
            required
            value={formData.title}
            onChange={set('title')}
            className={inputClass}
            placeholder="Weekly sync"
            autoFocus
          />
        </FormField>

        <FormField label="Description">
          <textarea
            rows={2}
            value={formData.description}
            onChange={set('description')}
            className={inputClass}
            placeholder="Optional description…"
          />
        </FormField>

        <FormField label="Challenge" required>
          <select required value={formData.challenge_id} onChange={set('challenge_id')} className={selectClass}>
            <option value="">Select a challenge</option>
            {challenges.map((c) => (
              <option key={c.uuid} value={c.uuid}>{c.title}</option>
            ))}
          </select>
        </FormField>
      </FormSection>

      <FormSection title="Schedule">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Start" required>
            <input
              type="datetime-local"
              required
              value={formData.start_time}
              onChange={set('start_time')}
              className={inputClass}
            />
          </FormField>

          <FormField label="End" required>
            <input
              type="datetime-local"
              required
              value={formData.end_time}
              onChange={set('end_time')}
              className={inputClass}
            />
          </FormField>
        </div>
      </FormSection>

      <FormFooter onCancel={onCancel} submitLabel="Create Meeting" />
    </form>
  );
}
