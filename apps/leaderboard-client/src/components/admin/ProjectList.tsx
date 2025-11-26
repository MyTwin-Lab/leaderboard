'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
}

export function ProjectList({ projects, onEdit, onDelete }: ProjectListProps) {
  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (project: Project) => (
        <div className="font-medium">{project.title}</div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (project: Project) => (
        <div className="text-sm text-white/70 line-clamp-2">
          {project.description || '—'}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (project: Project) => (
        <div className="text-sm text-white/60">
          {new Date(project.created_at).toLocaleDateString()}
        </div>
      ),
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (project: Project) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(project)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(project.uuid)}>
            Delete
          </Button>
        </div>
      ),
      width: '150px',
    },
  ];

  return <Table data={projects} columns={columns} emptyMessage="No projects found" />;
}
