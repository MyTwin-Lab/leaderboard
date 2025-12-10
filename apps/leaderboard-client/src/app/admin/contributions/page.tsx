'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { ContributionList } from '@/components/admin/ContributionList';
import type { Contribution, User, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error fetching contributions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Contributions"
        action={
          <select
            value={selectedChallengeId}
            onChange={(e) => setSelectedChallengeId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Challenges</option>
            {challenges.map((challenge) => (
              <option key={challenge.uuid} value={challenge.uuid}>
                {challenge.title}
              </option>
            ))}
          </select>
        }
      >
        <ContributionList
          contributions={contributions}
          users={users}
          challenges={challenges}
        />
      </Card>
    </div>
  );
}
