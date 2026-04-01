'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChallengeList } from '@/components/admin/ChallengeList';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { TeamModal } from '@/components/admin/TeamModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Challenge, Project } from '../../../../../../packages/database-service/domain/entities';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | undefined>();
  const [teamModalChallenge, setTeamModalChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchChallenges();
    fetchProjects();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch {
      toast('Failed to load challenges', 'error');
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

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchChallenges();
        setShowForm(false);
        toast('Challenge created', 'success');
      } else {
        toast('Failed to create challenge', 'error');
      }
    } catch {
      toast('Failed to create challenge', 'error');
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingChallenge) return;

    try {
      const res = await fetch(`/api/challenges/${editingChallenge.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchChallenges();
        setShowForm(false);
        setEditingChallenge(undefined);
        toast('Challenge updated', 'success');
      } else {
        toast('Failed to update challenge', 'error');
      }
    } catch {
      toast('Failed to update challenge', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Challenge',
      message: 'This will permanently delete the challenge and all associated data. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchChallenges();
        toast('Challenge deleted', 'success');
      } else {
        toast('Failed to delete challenge', 'error');
      }
    } catch {
      toast('Failed to delete challenge', 'error');
    }
  };

  const handleEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingChallenge(undefined);
  };

  const handleTeam = (challenge: Challenge) => {
    setTeamModalChallenge(challenge);
  };

  const handleSync = async (id: string) => {
    const ok = await confirm({
      title: 'Run Sync Evaluation',
      message: 'This will run the Sync Meeting evaluation for all participants. Continue?',
      confirmLabel: 'Run Sync',
    });
    if (!ok) return;

    setActionLoading(`sync-${id}`);
    try {
      const res = await fetch(`/api/challenges/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast(`${data.count} evaluations completed`, 'success');
      } else {
        toast(data.error ?? 'Sync failed', 'error');
      }
    } catch {
      toast('Error running sync', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (id: string) => {
    const ok = await confirm({
      title: 'Close Challenge',
      message: 'This will close the challenge and distribute rewards to all participants. This cannot be undone.',
      confirmLabel: 'Close & Distribute',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(`close-${id}`);
    try {
      const res = await fetch(`/api/challenges/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast(`${data.count} rewards distributed`, 'success');
        await fetchChallenges();
      } else {
        toast(data.error ?? 'Failed to close challenge', 'error');
      }
    } catch {
      toast('Error closing challenge', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="space-y-6">
        {showForm ? (
          <Card title={editingChallenge ? 'Edit Challenge' : 'New Challenge'}>
            <ChallengeForm
              challenge={editingChallenge}
              projects={projects}
              onSubmit={editingChallenge ? handleUpdate : handleCreate}
              onCancel={handleCancel}
            />
          </Card>
        ) : (
          <Card
            title="Challenges"
            count={challenges.length}
            className="rounded-md"
            action={
              <Button onClick={() => setShowForm(true)}>+ New Challenge</Button>
            }
          >
            <ChallengeList
              challenges={challenges}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTeam={handleTeam}
              onSync={handleSync}
              onClose={handleClose}
              actionLoading={actionLoading}
            />
          </Card>
        )}
      </div>

      {teamModalChallenge && (
        <TeamModal
          challengeId={teamModalChallenge.uuid}
          challengeTitle={teamModalChallenge.title}
          onClose={() => setTeamModalChallenge(null)}
        />
      )}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-white/5" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
