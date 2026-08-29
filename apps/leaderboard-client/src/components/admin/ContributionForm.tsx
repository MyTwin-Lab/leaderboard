'use client';

import { useState, useEffect } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import type { User, Challenge, Contribution } from '../../../../../packages/database-service/domain/entities';

interface ContributionFormProps {
  users: User[];
  challenges: Challenge[];
  contribution?: Contribution;
  onSubmit: (contribution: any) => void;
  onCancel: () => void;
}

export function ContributionForm({ users, challenges, contribution, onSubmit, onCancel }: ContributionFormProps) {
  const [formData, setFormData] = useState({
    title: contribution?.title ?? '',
    type: contribution?.type ?? 'code',
    description: contribution?.description ?? '',
    user_id: contribution?.user_id ?? '',
    challenge_id: contribution?.challenge_id ?? '',
    reward: contribution?.reward ?? 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Le reward d'une contribution adossée à la ledger est un cache de
  // SUM(reward_entries.points), resynchronisé par trigger Postgres — l'éditer
  // à la main serait écrasé à la prochaine écriture ledger.
  const [hasLedgerEntries, setHasLedgerEntries] = useState(false);

  useEffect(() => {
    if (!contribution) return;
    let cancelled = false;
    fetch(`/api/contributions/${contribution.uuid}/rewards`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.entries?.length > 0) setHasLedgerEntries(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contribution]);

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
            disabled={hasLedgerEntries}
          />
          {hasLedgerEntries && (
            <p className="mt-1 text-xs text-white/40">
              This reward is computed from the reward ledger and cannot be edited manually.
            </p>
          )}
        </FormField>
      </FormSection>

      <FormFooter
        onCancel={onCancel}
        submitLabel={contribution ? 'Update Contribution' : 'Create Contribution'}
        loading={isSubmitting}
      />
    </form>
  );
}
