'use client';

import { useState } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface RepoFormProps {
  projects: Project[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function RepoForm({ projects, onSubmit, onCancel }: RepoFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'github',
    external_repo_id: '',
    project_id: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      <FormSection title="General">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Title" required>
            <input
              type="text"
              required
              value={formData.title}
              onChange={set('title')}
              className={inputClass}
              placeholder="Repository name"
              autoFocus
            />
          </FormField>

          <FormField label="Type" required>
            <select required value={formData.type} onChange={set('type')} className={selectClass}>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Link">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="External Repo ID" hint="e.g. owner/repo">
            <input
              type="text"
              value={formData.external_repo_id}
              onChange={set('external_repo_id')}
              className={inputClass}
              placeholder="owner/repo-name"
            />
          </FormField>

          <FormField label="Project" required>
            <select required value={formData.project_id} onChange={set('project_id')} className={selectClass}>
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.uuid} value={p.uuid}>{p.title}</option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormFooter onCancel={onCancel} submitLabel="Create Repository" />
    </form>
  );
}
