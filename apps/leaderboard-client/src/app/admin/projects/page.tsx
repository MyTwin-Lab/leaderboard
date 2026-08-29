'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProjectList } from '@/components/admin/ProjectList';
import { ProjectForm } from '@/components/admin/ProjectForm';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus } from 'lucide-react';
import type { Project } from '../../../../../../packages/database-service/domain/entities';

interface UserBasic { uuid: string; full_name: string; role: string; }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [projectsData, usersData] = await Promise.all([
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
      ]);
      setProjects(projectsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
    }
    catch { toast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try { setProjects(await fetch('/api/projects').then(r => r.json())); }
    catch { toast('Failed to load projects', 'error'); }
  };

  const handleCreate = async (data: any) => {
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { await fetchProjects(); setActiveTab(0); toast('Project created', 'success'); }
    else toast('Failed to create project', 'error');
  };

  const handleUpdate = async (data: any) => {
    if (!editingProject) return;
    const res = await fetch(`/api/projects/${editingProject.uuid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { await fetchProjects(); setEditingProject(undefined); setActiveTab(0); toast('Project updated', 'success'); }
    else toast('Failed to update project', 'error');
  };

  const contributors = users.filter(u => u.role === 'contributor');

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Delete Project', message: 'This will permanently delete the project.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchProjects(); toast('Project deleted', 'success'); }
    else toast('Failed to delete project', 'error');
  };

  const handleEdit = (project: Project) => { setEditingProject(project); setActiveTab(1); };

  if (loading) return <Skeleton />;

  return (
    <div className="animate-fade-up space-y-6">
      <ControlledTabs active={activeTab} onChange={i => { if (i === 0) setEditingProject(undefined); setActiveTab(i); }} tabs={[
        {
          label: 'Projects',
          count: projects.length,
          panel: (
            <Card action={
              <Button onClick={() => { setEditingProject(undefined); setActiveTab(1); }}>
                <Plus className="h-3.5 w-3.5" /> New project
              </Button>
            }>
              <ProjectList projects={projects} users={users} onEdit={handleEdit} onDelete={handleDelete} />
            </Card>
          ),
        },
        {
          label: editingProject ? 'Edit Project' : 'New Project',
          panel: (
            <Card title={editingProject ? `Edit — ${editingProject.title}` : 'New Project'}>
              <ProjectForm
                project={editingProject}
                contributors={contributors}
                onSubmit={editingProject ? handleUpdate : handleCreate}
                onCancel={() => { setEditingProject(undefined); setActiveTab(0); }}
              />
            </Card>
          ),
        },
      ]} />
    </div>
  );
}

function ControlledTabs({ tabs, active, onChange }: {
  tabs: { label: string; count?: number; panel: React.ReactNode }[];
  active: number;
  onChange: (i: number) => void;
}) {
  return (
    <div>
      <div className="mb-6 flex overflow-x-auto border-b border-white/10">
        {tabs.map((tab, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`group relative shrink-0 px-4 py-2.5 font-medium transition-all duration-200 focus-visible:outline-none ${
              active === i ? 'text-[15px] text-white' : 'text-[13px] text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal text-white/40">{tab.count}</span>
              )}
            </span>
            <span className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-full bg-brandCP transition-transform duration-200 ${
              active === i ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
            }`} />
          </button>
        ))}
      </div>
      <div key={active} className="animate-fade-up">{tabs[active].panel}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-white/5" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}
    </div>
  );
}
