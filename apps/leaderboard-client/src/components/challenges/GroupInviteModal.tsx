'use client';

import { useState } from 'react';
import { Check, Copy, Users, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="animate-pop-in relative w-full max-w-lg rounded-[20px] border border-white/10 bg-background p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brandCP/12">
            <Users className="h-[18px] w-[18px] text-brandCP" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">Invite your group</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-white/40">
              Share this link with your teammates. You all work on the same board and
              branch, and the contribution is credited to everyone.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/60">{inviteUrl}</span>
          <button
            onClick={copy}
            style={{ color: '#fff' }}
            className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-brandCP px-3.5 py-2 text-xs font-semibold transition-all hover:bg-brandCP/90"
          >
            {copied ? <Check className="h-3.5 w-3.5" style={{ color: '#fff' }} /> : <Copy className="h-3.5 w-3.5" style={{ color: '#fff' }} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-white/30">
          {remaining === 0
            ? `This group is full (${maxSize} members).`
            : `${memberCount} of ${maxSize} members · room for ${remaining} more`}
        </p>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            style={{ color: '#fff' }}
            className="rounded-full bg-brandCP px-5 py-2.5 text-sm font-semibold transition-all hover:bg-brandCP/90"
          >
            Open the challenge
          </button>
        </div>
      </div>
    </div>
  );
}
