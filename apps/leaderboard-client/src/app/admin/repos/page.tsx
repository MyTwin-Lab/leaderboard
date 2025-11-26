'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RepoList } from '@/components/admin/RepoList';
import { RepoForm } from '@/components/admin/RepoForm';
import { RepoLinkModal } from '@/components/admin/RepoLinkModal';
import type { Repo, Project, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error fetching repos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch (error) {
      console.error('Error fetching challenges:', error);
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
      }
    } catch (error) {
      console.error('Error creating repo:', error);
    }
  };

  const handleLinkToChallenge = (repoId: string, repoTitle: string) => {
    setSelectedRepo({ id: repoId, title: repoTitle });
    setShowLinkModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repository?')) return;

    try {
      const res = await fetch(`/api/repos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchRepos();
      }
    } catch (error) {
      console.error('Error deleting repo:', error);
    }
  };

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
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
          action={
            <Button onClick={() => setShowForm(true)}>
              + New Repository
            </Button>
          }
        >
          <RepoList
            repos={repos}
            projects={projects}
            onLinkToChallenge={handleLinkToChallenge}
            onDelete={handleDelete}
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
    </div>
  );
}
