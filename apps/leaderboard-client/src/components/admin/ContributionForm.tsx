'use client';

import { useState } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import type { User, Challenge } from '../../../../../packages/database-service/domain/entities';

interface ContributionFormProps {
  users: User[];
  challenges: Challenge[];
  onSubmit: (contribution: any) => void;
  onCancel: () => void;
}

export function ContributionForm({ users, challenges, onSubmit, onCancel }: ContributionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'code',
    description: '',
    user_id: '',
    challenge_id: '',
    reward: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [field]: field === 'reward' ? parseInt(e.target.value) || 0 : e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      <FormSection title="Contribution">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Title" required>
            <input
              type="text"
              required
              value={formData.title}
              onChange={set('title')}
              className={inputClass}
              placeholder="Contribution title"
              autoFocus
            />
          </FormField>

          <FormField label="Type" required>
            <select required value={formData.type} onChange={set('type')} className={selectClass}>
              <option value="code">Code</option>
              <option value="model">Model</option>
              <option value="dataset">Dataset</option>
              <option value="docs">Documentation</option>
            </select>
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            rows={3}
            value={formData.description}
            onChange={set('description')}
            className={inputClass}
            placeholder="Optional description…"
          />
        </FormField>
      </FormSection>

      <FormSection title="Attribution">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="User" required>
            <select required value={formData.user_id} onChange={set('user_id')} className={selectClass}>
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.uuid} value={u.uuid}>
                  {u.full_name} (@{u.github_username})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Challenge" required>
            <select required value={formData.challenge_id} onChange={set('challenge_id')} className={selectClass}>
              <option value="">Select a challenge</option>
              {challenges.map((c) => (
                <option key={c.uuid} value={c.uuid}>{c.title}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Reward (CP)" required>
          <input
            type="number"
            required
            min={0}
            value={formData.reward}
            onChange={set('reward')}
            className={inputClass}
            placeholder="0"
          />
        </FormField>
      </FormSection>

      <FormFooter
        onCancel={onCancel}
        submitLabel="Create Contribution"
        loading={isSubmitting}
      />
    </form>
  );
}
