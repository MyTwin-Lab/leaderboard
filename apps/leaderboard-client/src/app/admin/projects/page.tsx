'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProjectList } from '@/components/admin/ProjectList';
import { ProjectForm } from '@/components/admin/ProjectForm';
import type { Project } from '../../../../../../packages/database-service/domain/entities';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
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
      }
    } catch (error) {
      console.error('Error creating project:', error);
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
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchProjects();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
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
    return <div className="text-white/60">Loading...</div>;
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
          action={
            <Button onClick={() => setShowForm(true)}>
              + New Project
            </Button>
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
