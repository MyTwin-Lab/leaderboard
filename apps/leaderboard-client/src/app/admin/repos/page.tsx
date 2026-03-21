'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RepoList } from '@/components/admin/RepoList';
import { RepoForm } from '@/components/admin/RepoForm';
import { RepoLinkModal } from '@/components/admin/RepoLinkModal';
import { RepoDetail } from '@/components/admin/RepoDetail';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Repo, Project, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchRepos();
    fetchProjects();
    fetchChallenges();
  }, []);

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      setRepos(data);
    } catch {
      toast('Failed to load repositories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch {
      console.error('Error fetching projects');
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch {
      console.error('Error fetching challenges');
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchRepos();
        setShowForm(false);
        toast('Repository created', 'success');
      } else {
        toast('Failed to create repository', 'error');
      }
    } catch {
      toast('Failed to create repository', 'error');
    }
  };

  const handleLinkToChallenge = (repoId: string, repoTitle: string) => {
    setSelectedRepo({ id: repoId, title: repoTitle });
    setShowLinkModal(true);
  };

  const handleViewDetail = (repoId: string, repoTitle: string) => {
    setSelectedRepo({ id: repoId, title: repoTitle });
    setShowDetail(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Repository',
      message: 'This will permanently delete the repository. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchRepos();
        toast('Repository deleted', 'success');
      } else {
        toast('Failed to delete repository', 'error');
      }
    } catch {
      toast('Failed to delete repository', 'error');
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <Card title="New Repository">
          <RepoForm
            projects={projects}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      ) : (
        <Card
          title="Repositories"
          count={repos.length}
          action={
            <Button onClick={() => setShowForm(true)}>+ New Repository</Button>
          }
        >
          <RepoList
            repos={repos}
            projects={projects}
            onLinkToChallenge={handleLinkToChallenge}
            onDelete={handleDelete}
            onViewDetail={handleViewDetail}
          />
        </Card>
      )}

      {showLinkModal && selectedRepo && (
        <RepoLinkModal
          repoId={selectedRepo.id}
          repoTitle={selectedRepo.title}
          onClose={() => {
            setShowLinkModal(false);
            setSelectedRepo(null);
          }}
        />
      )}

      {showDetail && selectedRepo && (
        <RepoDetail
          repoId={selectedRepo.id}
          repoTitle={selectedRepo.title}
          onClose={() => {
            setShowDetail(false);
            setSelectedRepo(null);
          }}
        />
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
