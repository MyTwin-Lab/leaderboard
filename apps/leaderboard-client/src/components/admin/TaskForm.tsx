'use client';

import { useState } from 'react';
import { FormField, FormFooter, inputClass, selectClass } from '@/components/ui/FormField';
import type { Task } from '../../../../../packages/database-service/domain/entities';

interface ChallengeRepoInfo {
  repo_id: string;
  repo_type: string;
  repo_external_id?: string;
  challenge_id: string;
}

interface TaskFormProps {
  task?: Task;
  challengeId: string;
  availableParentTasks: Task[];
  // NOTE: kept in props for now — the repo picker below is unused since
  // tasks no longer carry a repo_id (personal-boards refactor). A later
  // task removes this prop once callers stop passing it.
  availableRepos: ChallengeRepoInfo[];
  onSubmit: (data: {
    title: string;
    description?: string;
    parent_task_id?: string;
    challenge_id: string;
  }) => void;
  onCancel: () => void;
}

export function TaskForm({ task, challengeId, availableParentTasks, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    parent_task_id: task?.parent_task_id ?? '',
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    onSubmit({
      title: formData.title,
      description: formData.description || undefined,
      parent_task_id: formData.parent_task_id || undefined,
      challenge_id: challengeId,
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">
        {task ? 'Edit Task' : 'New Task'}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Title" required>
          <input
            type="text"
            required
            value={formData.title}
            onChange={set('title')}
            className={inputClass}
            placeholder="Task title"
            autoFocus
          />
        </FormField>

        <FormField label="Parent Task">
          <select value={formData.parent_task_id} onChange={set('parent_task_id')} className={selectClass}>
            <option value="">No parent (main task)</option>
            {availableParentTasks
              .filter((t) => t.uuid !== task?.uuid)
              .map((t) => (
                <option key={t.uuid} value={t.uuid}>{t.title}</option>
              ))}
          </select>
        </FormField>
      </div>

      <FormField label="Description">
        <textarea
          rows={2}
          value={formData.description}
          onChange={set('description')}
          className={inputClass}
          placeholder="Task description (optional)"
        />
      </FormField>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg bg-brandCP px-3 py-1.5 text-sm font-semibold text-black hover:bg-brandCP/80"
        >
          {task ? 'Update Task' : 'Add Task'}
        </button>
      </div>
    </div>
  );
}
