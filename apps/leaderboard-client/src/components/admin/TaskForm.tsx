'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Task } from '../../../../../packages/database-service/domain/entities';

interface TaskFormProps {
  task?: Task;
  challengeId: string;
  availableParentTasks: Task[];
  onSubmit: (data: {
    title: string;
    description?: string;
    type: 'solo' | 'concurrent';
    parent_task_id?: string;
    challenge_id: string;
  }) => void;
  onCancel: () => void;
}

export function TaskForm({ task, challengeId, availableParentTasks, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    type: task?.type || 'solo' as 'solo' | 'concurrent',
    parent_task_id: task?.parent_task_id || '',
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    onSubmit({
      title: formData.title,
      description: formData.description || undefined,
      type: formData.type,
      parent_task_id: formData.parent_task_id || undefined,
      challenge_id: challengeId,
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="Task title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Type *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'solo' | 'concurrent' })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="solo">Solo</option>
            <option value="concurrent">Concurrent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Parent Task (optional)
        </label>
        <select
          value={formData.parent_task_id}
          onChange={(e) => setFormData({ ...formData, parent_task_id: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">No parent (main task)</option>
          {availableParentTasks
            .filter(t => t.uuid !== task?.uuid) // Ne pas permettre de se sélectionner soi-même
            .map((t) => (
              <option key={t.uuid} value={t.uuid}>
                {t.title}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Description
        </label>
        <textarea
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
          placeholder="Task description (optional)"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit}>
          {task ? 'Update' : 'Add'} Task
        </Button>
      </div>
    </div>
  );
}
