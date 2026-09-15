'use client';

import { Users } from 'lucide-react';
import { Markdown } from '@/components/ui/Markdown';
import { JoinButton } from '@/components/challenges/JoinButton';
import { flowCatalog } from '@/distribution/mytwin.flows';

/**
 * Le brief d'un challenge, affiché à qui ne l'a pas encore rejoint — connecté
 * ou non — à la place des KPI et de l'espace de travail, qui n'ont rien à lui
 * dire tant qu'il n'a ni board, ni branche, ni soumission.
 *
 * Le contenu est libre : c'est le Markdown rédigé par l'admin. La maquette
 * suppose des sections Context / Objective / Expected result, mais rien ici
 * ne les impose — le squelette est proposé au moment de la rédaction.
 */

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
  content, challengeType, onAcceptInvite, joining, error, invite,
}: {
  content: string;
  challengeType: string;
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
        {/* La page challenge a déjà son <h1> (le titre) : un brief qui commence
            par `# Titre` en produirait un second. */}
        <Markdown source={content} variant="prose" headingOffset={1} />
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
          /* Pas de bouton ici : le `Join` de l'en-tête est le seul point
             d'entrée de la page, et c'est lui qui ouvre la modale. Le brief
             reste de la lecture, et la légende — fournie par le flow — dit
             simplement ce que rejoindre implique. L'avertissement
             d'irréversibilité, lui, vit dans la modale, là où la décision se
             prend. */
          <p className="text-center text-xs text-white/35">
            {flowCatalog.get(challengeType)?.joinCaption ?? 'Joining adds you to this challenge.'}
          </p>
        )}
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
