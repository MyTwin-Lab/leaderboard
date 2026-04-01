'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Pencil, Trash2 } from 'lucide-react';
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
      header: 'Project',
      render: (project: Project) => (
        <div className="font-medium text-white">{project.title}</div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (project: Project) => (
        <div className="text-sm text-white/50 line-clamp-1">
          {project.description || <span className="text-white/25 italic">No description</span>}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (project: Project) => (
        <div className="text-sm text-white/50">
          {new Date(project.created_at).toLocaleDateString('fr-FR')}
        </div>
      ),
      width: '110px',
    },
    {
      key: 'actions',
      header: '',
      render: (project: Project) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(project)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(project.uuid)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '80px',
    },
  ];

  return <Table data={projects} columns={columns} emptyMessage="No projects yet" />;
}
