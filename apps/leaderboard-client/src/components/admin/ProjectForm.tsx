'use client';

import { useState } from 'react';
import { FormField, FormFooter, inputClass } from '@/components/ui/FormField';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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

      <FormFooter
        onCancel={onCancel}
        submitLabel={project ? 'Update Project' : 'Create Project'}
      />
    </form>
  );
}
