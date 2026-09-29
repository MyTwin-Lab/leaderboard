'use client';

import { useState } from 'react';
import { FormField, FormFooter, inputClass, selectClass } from '@/components/ui/FormField';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface RepoFormProps {
  projects: Project[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

/** Le formulaire de dépôt des pages admin — une carte vitrine posée dans la page sombre. */
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

  return (
    <form onSubmit={handleSubmit} className="v-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Title" required>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={inputClass}
            placeholder="Repository name"
          />
        </FormField>

        <FormField label="Type" required>
          <select
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className={selectClass}
          >
            <option value="github">GitHub</option>
            <option value="kaggle_dataset">Kaggle Dataset</option>
            <option value="kaggle_model">Kaggle Model</option>
          </select>
        </FormField>

        <FormField label="External Repo ID">
          <input
            type="text"
            value={formData.external_repo_id}
            onChange={(e) => setFormData({ ...formData, external_repo_id: e.target.value })}
            className={inputClass}
            placeholder={
              formData.type === 'kaggle_dataset' || formData.type === 'kaggle_model'
                ? 'owner/slug (optional, filled by contributors)'
                : 'owner/repo'
            }
          />
        </FormField>

        <FormField label="Project" required>
          <select
            required
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            className={selectClass}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.uuid} value={project.uuid}>
                {project.title}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormFooter onCancel={onCancel} submitLabel="Create Repository" />
    </form>
  );
}
