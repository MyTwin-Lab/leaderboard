'use client';

import { useState } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import type { EvaluationGrid } from '../../../../../packages/database-service/domain/entities';

interface EvaluationGridFormProps {
  grid?: EvaluationGrid;
  onSubmit: (data: {
    slug: string;
    name: string;
    description?: string;
    version: number;
    status: string;
    instructions?: string;
  }) => void;
  onCancel: () => void;
}

export function EvaluationGridForm({ grid, onSubmit, onCancel }: EvaluationGridFormProps) {
  const [formData, setFormData] = useState({
    name: grid?.name ?? '',
    slug: grid?.slug ?? '',
    description: grid?.description ?? '',
    version: grid?.version ?? 1,
    status: grid?.status ?? 'draft',
    instructions: grid?.instructions ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      description: formData.description || undefined,
      instructions: formData.instructions || undefined,
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [field]: field === 'version' ? Number(e.target.value) : e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      <FormSection title="Identity">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Name" required>
            <input
              type="text"
              required
              value={formData.name}
              onChange={set('name')}
              className={inputClass}
              placeholder="Code Quality Grid"
              autoFocus
            />
          </FormField>

          <FormField label="Slug" required hint="Unique identifier, lowercase with dashes">
            <input
              type="text"
              required
              value={formData.slug}
              onChange={set('slug')}
              className={inputClass}
              placeholder="code-quality"
            />
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            rows={2}
            value={formData.description}
            onChange={set('description')}
            className={inputClass}
            placeholder="What does this grid evaluate?"
          />
        </FormField>
      </FormSection>

      <FormSection title="Configuration">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Version">
            <input
              type="number"
              min={1}
              value={formData.version}
              onChange={set('version')}
              className={inputClass}
            />
          </FormField>

          <FormField label="Status">
            <select value={formData.status} onChange={set('status')} className={selectClass}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="AI Evaluator">
        <FormField label="Instructions" hint="Instructions sent to the AI agent during evaluation">
          <textarea
            rows={5}
            value={formData.instructions}
            onChange={set('instructions')}
            className={inputClass}
            placeholder="You are evaluating a code contribution. Focus on..."
          />
        </FormField>
      </FormSection>

      <FormFooter
        onCancel={onCancel}
        submitLabel={grid ? 'Update Grid' : 'Create Grid'}
      />
    </form>
  );
}
