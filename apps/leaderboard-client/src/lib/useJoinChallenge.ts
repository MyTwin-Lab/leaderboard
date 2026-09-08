'use client';

import { useState } from 'react';

/** Ce que le POST /join renvoie une fois la participation créée. */
export interface JoinResult {
  /** Posé uniquement quand on vient de créer un groupe : c'est le jeton d'invitation. */
  groupId?: string;
  /** Membres du groupe sans compte GitHub connecté — ils ne pourront pas pousser. */
  missingGithub?: string[];
}

export type JoinMode =
  | { mode?: 'solo' }
  /** Créer un groupe et récupérer son lien d'invitation. */
  | { mode: 'group' }
  /** Rejoindre le groupe désigné par un lien reçu. */
  | { group: string };

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

  const join = async (options: JoinMode = {}): Promise<JoinResult | null> => {
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to join');
        return null;
      }
      const data = await res.json().catch(() => ({}));
      // L'overview est rechargée avant que l'appelant n'ouvre la modale : elle
      // porte le group_id du visiteur, dont dépend la bannière du workspace.
      await onJoined();
      return { groupId: data.group_id, missingGithub: data.missingGithub };
    } catch {
      setError('Network error');
      return null;
    } finally {
      setJoining(false);
    }
  };

  return { join, joining, error };
}
