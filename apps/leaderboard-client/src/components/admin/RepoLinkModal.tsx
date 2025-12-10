'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

interface RepoLinkModalProps {
  repoId: string;
  repoTitle: string;
  onClose: () => void;
}

export function RepoLinkModal({ repoId, repoTitle, onClose }: RepoLinkModalProps) {
  const [linkedChallenges, setLinkedChallenges] = useState<Challenge[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinkedChallenges();
    fetchAllChallenges();
  }, [repoId]);

  const fetchLinkedChallenges = async () => {
    try {
      const res = await fetch(`/api/repos/${repoId}/challenges`);
      const data = await res.json();
      setLinkedChallenges(data);
    } catch (error) {
      console.error('Error fetching linked challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setAvailableChallenges(data);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const handleLink = async () => {
    if (!selectedChallengeId) return;

    try {
      const res = await fetch('/api/repos/challenge-repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: selectedChallengeId, repo_id: repoId }),
      });

      if (res.ok) {
        await fetchLinkedChallenges();
        setSelectedChallengeId('');
      }
    } catch (error) {
      console.error('Error linking repo:', error);
    }
  };

  const handleUnlink = async (challengeId: string) => {
    if (!confirm('Unlink this challenge from the repo?')) return;

    try {
      const res = await fetch(`/api/repos/challenge-repos?challenge_id=${challengeId}&repo_id=${repoId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchLinkedChallenges();
      }
    } catch (error) {
      console.error('Error unlinking repo:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-background border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            🔗 Link Repo: {repoTitle}
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
            {/* Linked challenges */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Linked Challenges</h3>
              {linkedChallenges.length === 0 ? (
                <p className="text-sm text-white/50">No challenges linked yet</p>
              ) : (
                <div className="space-y-2">
                  {linkedChallenges.map((challenge, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div>
                        <div className="font-medium text-white">{challenge.title}</div>
                        <div className="text-sm text-white/60">
                          {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleUnlink(challenge.uuid)}
                      >
                        Unlink
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link new challenge */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Link to Challenge</h3>
              <div className="flex gap-3">
                <select
                  value={selectedChallengeId}
                  onChange={(e) => setSelectedChallengeId(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Select a challenge</option>
                  {availableChallenges
                    .filter(c => !linkedChallenges.some(lc => lc.uuid === c.uuid))
                    .map((challenge) => (
                      <option key={challenge.uuid} value={challenge.uuid}>
                        {challenge.title} ({challenge.status})
                      </option>
                    ))}
                </select>
                <Button onClick={handleLink} disabled={!selectedChallengeId}>
                  Link
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
