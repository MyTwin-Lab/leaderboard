'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChallengeList } from '@/components/admin/ChallengeList';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { TeamModal } from '@/components/admin/TeamModal';
import type { Challenge, Project } from '../../../../../../packages/database-service/domain/entities';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | undefined>();
  const [teamModalChallenge, setTeamModalChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
    fetchProjects();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch (error) {
      console.error('Error fetching challenges:', error);
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
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
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
      }
    } catch (error) {
      console.error('Error updating challenge:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) return;
    
    try {
      const res = await fetch(`/api/challenges/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchChallenges();
      }
    } catch (error) {
      console.error('Error deleting challenge:', error);
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
    if (!confirm('Run Sync Meeting evaluation?')) return;

    try {
      const res = await fetch(`/api/challenges/${id}/sync`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ ${data.count} evaluations completed!`);
      }
    } catch (error) {
      alert('Error running sync');
      console.error(error);
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Close this challenge and distribute rewards?')) return;

    try {
      const res = await fetch(`/api/challenges/${id}/close`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ ${data.count} rewards distributed!`);
        await fetchChallenges();
      }
    } catch (error) {
      alert('Error closing challenge');
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
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
            action={
              <Button onClick={() => setShowForm(true)}>
                + New Challenge
              </Button>
            }
          >
            <ChallengeList
              challenges={challenges}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTeam={handleTeam}
              onSync={handleSync}
              onClose={handleClose}
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
