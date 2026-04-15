'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
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
  const [slug, setSlug] = useState(grid?.slug ?? '');
  const [name, setName] = useState(grid?.name ?? '');
  const [description, setDescription] = useState(grid?.description ?? '');
  const [version, setVersion] = useState(grid?.version ?? 1);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(grid?.status ?? 'draft');
  const [instructions, setInstructions] = useState(grid?.instructions ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      slug,
      name,
      description: description || undefined,
      version,
      status,
      instructions: instructions || undefined,
    });
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Code Quality Grid"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Slug *</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="code-quality"
            required
          />
        </div>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Version</label>
          <input
            type="number"
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
            className={inputClass}
            min={1}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
            className={inputClass}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Instructions (for AI evaluator)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className={inputClass}
          rows={4}
          placeholder="Instructions for the AI evaluator agent..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{grid ? 'Update Grid' : 'Create Grid'}</Button>
      </div>
    </form>
  );
}
