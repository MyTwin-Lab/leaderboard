'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ContributionList } from '@/components/admin/ContributionList';
import { ContributionForm } from '@/components/admin/ContributionForm';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Contribution, User, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchUsers();
    fetchChallenges();
  }, []);

  useEffect(() => {
    fetchContributions();
  }, [selectedChallengeId]);

  const fetchContributions = async () => {
    try {
      const endpoint = selectedChallengeId
        ? `/api/contributions/challenge/${selectedChallengeId}`
        : '/api/contributions';
      const res = await fetch(endpoint);
      const data = await res.json();
      setContributions(data);
    } catch {
      toast('Failed to load contributions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch {
      console.error('Error fetching users');
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

  const handleCreateContribution = async (contribution: any) => {
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contribution),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create contribution');
      }

      const newContribution = await res.json();
      setContributions((prev) => [newContribution, ...prev]);
      setShowForm(false);
      toast('Contribution created', 'success');
    } catch (error) {
      toast('Failed to create contribution: ' + (error as Error).message, 'error');
    }
  };

  const handleUpdateContribution = async (contribution: any) => {
    if (!editingContribution) return;
    try {
      const res = await fetch(`/api/contributions/${editingContribution.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contribution),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update contribution');
      }

      const updated = await res.json();
      setContributions((prev) => prev.map((c) => (c.uuid === updated.uuid ? updated : c)));
      setEditingContribution(null);
      toast('Contribution updated', 'success');
    } catch (error) {
      toast('Failed to update contribution: ' + (error as Error).message, 'error');
    }
  };

  const handleDeleteContribution = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Contribution',
      message: 'This will permanently delete this contribution. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/contributions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete contribution');
      }
      setContributions((prev) => prev.filter((c) => c.uuid !== id));
      if (editingContribution?.uuid === id) setEditingContribution(null);
      toast('Contribution deleted', 'success');
    } catch (error) {
      toast('Failed to delete contribution: ' + (error as Error).message, 'error');
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Contributions"
        count={contributions.length}
        action={
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => {
                setEditingContribution(null);
                setShowForm(true);
              }}
            >
              Add Contribution
            </Button>
            <select
              value={selectedChallengeId}
              onChange={(e) => setSelectedChallengeId(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
            >
              <option value="">All Challenges</option>
              {challenges.map((challenge) => (
                <option key={challenge.uuid} value={challenge.uuid}>
                  {challenge.title}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ContributionList
          contributions={contributions}
          users={users}
          challenges={challenges}
          onEdit={(contribution) => {
            setShowForm(false);
            setEditingContribution(contribution);
          }}
          onDelete={handleDeleteContribution}
        />
      </Card>

      {showForm && (
        <Card title="New Contribution">
          <ContributionForm
            users={users}
            challenges={challenges}
            onSubmit={handleCreateContribution}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {editingContribution && (
        <Card title="Edit Contribution">
          <ContributionForm
            key={editingContribution.uuid}
            users={users}
            challenges={challenges}
            contribution={editingContribution}
            onSubmit={handleUpdateContribution}
            onCancel={() => setEditingContribution(null)}
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
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
