'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Repository name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Type *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            External Repo ID
          </label>
          <input
            type="text"
            value={formData.external_repo_id}
            onChange={(e) => setFormData({ ...formData, external_repo_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="owner/repo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Project *
          </label>
          <select
            required
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.uuid} value={project.uuid}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Create Repository
        </Button>
      </div>
    </form>
  );
}
