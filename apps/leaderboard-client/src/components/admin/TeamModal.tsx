'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { User } from '../../../../../packages/database-service/domain/entities';

interface TeamModalProps {
  challengeId: string;
  challengeTitle: string;
  onClose: () => void;
}

export function TeamModal({ challengeId, challengeTitle, onClose }: TeamModalProps) {
  const [team, setTeam] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
    fetchUsers();
  }, [challengeId]);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/team`);
      const data = await res.json();
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setAvailableUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const res = await fetch(`/api/challenges/${challengeId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId }),
      });

      if (res.ok) {
        await fetchTeam();
        setSelectedUserId('');
      }
    } catch (error) {
      console.error('Error adding team member:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the team?')) return;

    try {
      const res = await fetch(`/api/challenges/${challengeId}/team/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchTeam();
      }
    } catch (error) {
      console.error('Error removing team member:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-background border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            👥 Team: {challengeTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-white/60">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Current team */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Current Team</h3>
              {team.length === 0 ? (
                <p className="text-sm text-white/50">No team members yet</p>
              ) : (
                <div className="space-y-2">
                  {team.map((member) => (
                    <div
                      key={member.uuid}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div>
                        <div className="font-medium text-white">{member.full_name}</div>
                        <div className="text-sm text-white/60">@{member.github_username}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRemoveMember(member.uuid)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add member */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Add Member</h3>
              <div className="flex gap-3">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Select a user</option>
                  {availableUsers
                    .filter(u => !team.some(m => m.uuid === u.uuid))
                    .map((user) => (
                      <option key={user.uuid} value={user.uuid}>
                        {user.full_name} (@{user.github_username})
                      </option>
                    ))}
                </select>
                <Button onClick={handleAddMember} disabled={!selectedUserId}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
