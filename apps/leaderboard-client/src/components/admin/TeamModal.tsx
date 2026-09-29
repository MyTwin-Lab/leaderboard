'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';
import type { User } from '../../../../../packages/database-service/domain/entities';

import './admin-forms-vitrine.css';

interface TeamModalProps {
  challengeId: string;
  challengeTitle: string;
  onClose: () => void;
}

/** L'équipe d'un challenge : ses membres, et l'ajout d'un compte. Sur la modale vitrine. */
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
    <Modal open onClose={onClose} title={`Team: ${challengeTitle}`} icon={<Users />} size="lg">
      {loading ? (
        <p className="v-quiet">Loading...</p>
      ) : (
        <>
          {/* Current team */}
          <div className="v-section">
            <p className="v-section-title">Current Team</p>
            {team.length === 0 ? (
              <p className="v-help">No team members yet</p>
            ) : (
              <div className="v-rows">
                {team.map((member, index) => (
                  <div key={index} className="v-row">
                    <div className="v-row-text">
                      <span className="v-row-title">{member.full_name}</span>
                      <span className="v-row-meta">@{member.github_username}</span>
                    </div>
                    <div className="v-row-actions">
                      <button type="button" className="v-btn-danger v-btn-sm" onClick={() => handleRemoveMember(member.uuid)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add member */}
          <div className="v-section">
            <p className="v-section-title">Add Member</p>
            <div className="v-af-add">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="v-select"
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
              <button type="button" className="v-btn" onClick={handleAddMember} disabled={!selectedUserId}>
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
