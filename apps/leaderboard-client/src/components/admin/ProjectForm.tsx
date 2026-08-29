'use client';

import { useState } from 'react';
import { FormField, FormFooter, inputClass } from '@/components/ui/FormField';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface Contributor {
  uuid: string;
  full_name: string;
}

interface ProjectFormProps {
  project?: Project;
  contributors?: Contributor[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, contributors = [], onSubmit, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
    manager_id: project?.manager_id ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      manager_id: formData.manager_id || null,
    });
  };

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <FormField label="Title" required>
        <input
          type="text"
          required
          value={formData.title}
          onChange={set('title')}
          className={inputClass}
          placeholder="My awesome project"
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <textarea
          rows={4}
          value={formData.description}
          onChange={set('description')}
          className={inputClass}
          placeholder="What is this project about?"
        />
      </FormField>

      <FormField label="Manager">
        <select
          value={formData.manager_id}
          onChange={set('manager_id')}
          className={inputClass}
        >
          <option value="">No manager</option>
          {contributors.map(c => (
            <option key={c.uuid} value={c.uuid}>{c.full_name}</option>
          ))}
        </select>
      </FormField>

      <FormFooter
        onCancel={onCancel}
        submitLabel={project ? 'Update Project' : 'Create Project'}
      />
    </form>
  );
}
