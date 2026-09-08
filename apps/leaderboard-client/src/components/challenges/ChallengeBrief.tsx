'use client';

import { Users } from 'lucide-react';
import { Markdown } from '@/components/ui/Markdown';
import { JoinButton } from '@/components/challenges/JoinButton';

/**
 * Le brief d'un challenge, affiché à un contributeur connecté qui ne l'a pas
 * encore rejoint — à la place des KPI et de l'espace de travail, qui n'ont
 * rien à lui dire tant qu'il n'a ni board, ni branche, ni soumission.
 *
 * Le contenu est libre : c'est le Markdown rédigé par l'admin. La maquette
 * suppose des sections Context / Objective / Expected result, mais rien ici
 * ne les impose — le squelette est proposé au moment de la rédaction.
 */

const JOIN_CAPTIONS: Record<string, string> = {
  code: 'Joining copies the template tasks onto your board and provisions your branch.',
  ml: 'Joining adds you to this challenge — you can then submit your dataset and model.',
};

/** Ce qu'on sait du groupe quand le visiteur arrive par un lien d'invitation. */
export interface GroupInvite {
  ownerName: string;
  size: number;
  maxSize: number;
  joinable: boolean;
  reason: string | null;
}

const INVITE_BLOCKERS: Record<string, string> = {
  challenge_closed: 'This challenge is closed.',
  already_member: "You're already in this group.",
  already_solo: 'You already joined this challenge on your own, so you cannot switch to a group.',
  group_full: 'This group is full.',
};

export function ChallengeBrief({
  content, challengeType, onJoin, onJoinGroup, onAcceptInvite, joining, error, invite,
}: {
  content: string;
  challengeType: string;
  onJoin: () => void;
  onJoinGroup: () => void;
  onAcceptInvite: () => void;
  joining: boolean;
  error?: string;
  /** Non nul quand l'URL porte un `?group=` valide. */
  invite?: GroupInvite | null;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <div className="h-0.5 w-full rounded-full bg-white/15" />

      {/* Colonne de lecture : la largeur du texte prime sur celle de la page. */}
      <div className="mx-auto w-full max-w-[760px]">
        <Markdown source={content} variant="prose" />
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-3 pt-2">
        {invite ? (
          // Arrivée par lien : le seul appel à l'action est de rejoindre ce
          // groupe-là. Proposer aussi le join solo à cet endroit invite à
          // cliquer à côté, et la bascule est irréversible.
          <>
            <JoinButton
              onClick={onAcceptInvite}
              joining={joining}
              label={`Join ${invite.ownerName}'s group`}
              icon={<Users className="h-4 w-4" style={{ color: '#fff' }} />}
              className={invite.joinable ? '' : 'pointer-events-none opacity-40'}
            />
            <p className="text-center text-xs text-white/35">
              {invite.joinable
                ? `${invite.size} of ${invite.maxSize} members · you share their board, branch and contribution.`
                : INVITE_BLOCKERS[invite.reason ?? ''] ?? 'This invite is no longer valid.'}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <JoinButton onClick={onJoin} joining={joining} />
              <JoinButton
                onClick={onJoinGroup}
                joining={joining}
                variant="secondary"
                label="Join as a group"
                icon={<Users className="h-4 w-4" />}
              />
            </div>
            <p className="text-center text-xs text-white/35">
              {JOIN_CAPTIONS[challengeType] ?? 'Joining adds you to this challenge.'}
            </p>
            {/* La bascule solo → groupe est refusée après coup : le board est
                déjà copié et la branche provisionnée. Le dire ici évite de le
                découvrir au moment où il est trop tard. */}
            <p className="text-center text-[11px] text-white/25">
              You cannot switch between the two afterwards.
            </p>
          </>
        )}
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
