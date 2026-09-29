'use client';

import { useState } from 'react';
import { Check, Copy, Users } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';

import './challenge-overlays-vitrine.css';

/**
 * Le lien d'invitation d'un groupe, à partager soi-même.
 *
 * Il n'y a pas d'invitation en base, pas d'état "en attente", pas de
 * notification : le lien *est* l'invitation. D'où cette modale, seul endroit
 * où il apparaît — à l'ouverture après la création du groupe, puis à la
 * demande depuis la bannière du workspace.
 */
export function GroupInviteModal({
  inviteUrl, memberCount, maxSize, onClose,
}: {
  inviteUrl: string;
  memberCount: number;
  maxSize: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Presse-papiers refusé (http, permission) — le lien reste sélectionnable
      // à la main, on montre quand même la confirmation.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remaining = Math.max(0, maxSize - memberCount);

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite your group"
      subtitle="Share this link with your teammates. You all work on the same board and branch, and the contribution is credited to everyone."
      icon={<Users />}
      center
      actions={
        <button type="button" onClick={onClose} className="v-btn" data-tone="accent">
          Open the challenge
        </button>
      }
    >
      <div className="v-co-link">
        <code>{inviteUrl}</code>
        <button type="button" onClick={copy} className="v-btn v-btn-sm" data-tone="accent">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="v-help v-co-centered" data-size="xs">
        {remaining === 0
          ? `This group is full (${maxSize} members).`
          : `${memberCount} of ${maxSize} members · room for ${remaining} more`}
      </p>
    </Modal>
  );
}
