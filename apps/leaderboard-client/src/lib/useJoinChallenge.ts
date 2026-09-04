'use client';

import { useState } from 'react';

/**
 * Rejoindre un challenge — extrait de CodeChallengePanel, qui n'était plus le
 * seul appelant une fois le brief affiché devant l'espace de travail.
 *
 * `onJoined` est le rechargement de l'overview : c'est lui qui fait basculer
 * `isMember`, donc le brief vers la page complète, sans rechargement de page.
 */
export function useJoinChallenge(
  challengeId: string,
  onJoined: () => Promise<void> | void
) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to join');
        return;
      }
      await onJoined();
    } catch {
      setError('Network error');
    } finally {
      setJoining(false);
    }
  };

  return { join, joining, error };
}
