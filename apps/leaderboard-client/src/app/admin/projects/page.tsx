'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProjectList } from '@/components/admin/ProjectList';
import { ProjectForm } from '@/components/admin/ProjectForm';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Project } from '../../../../../../packages/database-service/domain/entities';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch {
      toast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchProjects();
        setShowForm(false);
        toast('Project created', 'success');
      } else {
        toast('Failed to create project', 'error');
      }
    } catch {
      toast('Failed to create project', 'error');
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingProject) return;

    try {
      const res = await fetch(`/api/projects/${editingProject.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchProjects();
        setShowForm(false);
        setEditingProject(undefined);
        toast('Project updated', 'success');
      } else {
        toast('Failed to update project', 'error');
      }
    } catch {
      toast('Failed to update project', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Project',
      message: 'This will permanently delete the project. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        toast('Project deleted', 'success');
      } else {
        toast('Failed to delete project', 'error');
      }
    } catch {
      toast('Failed to delete project', 'error');
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProject(undefined);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <Card title={editingProject ? 'Edit Project' : 'New Project'}>
          <ProjectForm
            project={editingProject}
            onSubmit={editingProject ? handleUpdate : handleCreate}
            onCancel={handleCancel}
          />
        </Card>
      ) : (
        <Card
          title="Projects"
          count={projects.length}
          action={
            <Button onClick={() => setShowForm(true)}>+ New Project</Button>
          }
        >
          <ProjectList
            projects={projects}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Card>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-white/5" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
