'use client';

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

export function ChallengeBrief({
  content, challengeType, onJoin, joining, error,
}: {
  content: string;
  challengeType: string;
  onJoin: () => void;
  joining: boolean;
  error?: string;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <div className="h-0.5 w-full rounded-full bg-white/15" />

      {/* Colonne de lecture : la largeur du texte prime sur celle de la page. */}
      <div className="mx-auto w-full max-w-[760px]">
        <Markdown source={content} variant="prose" />
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-3 pt-2">
        <JoinButton onClick={onJoin} joining={joining} />
        <p className="text-center text-xs text-white/35">
          {JOIN_CAPTIONS[challengeType] ?? 'Joining adds you to this challenge.'}
        </p>
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
