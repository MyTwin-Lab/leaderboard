'use client';

import { useState, useEffect } from 'react';
import { Link2 } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';
import type { Challenge } from '../../../../../packages/database-service/domain/entities';

import './admin-forms-vitrine.css';

interface RepoLinkModalProps {
  repoId: string;
  repoTitle: string;
  onClose: () => void;
}

/** Les challenges liés à un dépôt, et le lien vers un de plus. Sur la modale vitrine. */
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
    <Modal open onClose={onClose} title={`Link Repo: ${repoTitle}`} icon={<Link2 />} size="lg">
      {loading ? (
        <p className="v-quiet">Loading...</p>
      ) : (
        <>
          {/* Linked challenges */}
          <div className="v-section">
            <p className="v-section-title">Linked Challenges</p>
            {linkedChallenges.length === 0 ? (
              <p className="v-help">No challenges linked yet</p>
            ) : (
              <div className="v-rows">
                {linkedChallenges.map((challenge, index) => (
                  <div key={index} className="v-row">
                    <div className="v-row-text">
                      <span className="v-row-title">{challenge.title}</span>
                      {(challenge.start_date || challenge.end_date) && (
                        <span className="v-row-meta">
                          {challenge.start_date ? new Date(challenge.start_date).toLocaleDateString() : '-'} - {challenge.end_date ? new Date(challenge.end_date).toLocaleDateString() : '-'}
                        </span>
                      )}
                    </div>
                    <div className="v-row-actions">
                      <button type="button" className="v-btn-danger v-btn-sm" onClick={() => handleUnlink(challenge.uuid)}>
                        Unlink
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link new challenge */}
          <div className="v-section">
            <p className="v-section-title">Link to Challenge</p>
            <div className="v-af-add">
              <select
                value={selectedChallengeId}
                onChange={(e) => setSelectedChallengeId(e.target.value)}
                className="v-select"
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
              <button type="button" className="v-btn" onClick={handleLink} disabled={!selectedChallengeId}>
                Link
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
