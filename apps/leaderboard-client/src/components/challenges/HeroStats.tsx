'use client';

import { TeamAvatars } from '@/components/ui/TeamAvatars';
import type { TeamMember } from '@/lib/types';

/**
 * Un KPI du hero d'un challenge : CP distribués, la mesure propre au type
 * (tâches / métrique / contributions), et l'équipe. Les trois champs de droite
 * sont optionnels — une validation n'a ni barre ni unité, seule l'équipe porte
 * des avatars.
 */
export interface HeroStat {
  key: string;
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  /** Largeur CSS de la barre de progression, `undefined` = pas de barre. */
  barWidth?: string;
  team?: TeamMember[];
}

/**
 * Les KPI ne sont plus trois cartes mais une ligne de mesures, posée sous le
 * titre par un simple filet : la maquette leur retire leur cadre pour qu'ils
 * se lisent comme la suite du hero, pas comme un bloc concurrent.
 *
 * Une seule disposition depuis que l'écran vitrine a remplacé celui du brief :
 * la variante en colonne servait sa colonne de droite, qui ne porte plus de
 * mesures.
 */
export function HeroStats({
  stats,
  className = '',
}: {
  stats: HeroStat[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/[0.09] pt-3.5 ${className}`}>
      {stats.map((stat) => (
        <div
          key={stat.key}
          // Le contenu d'une mesure peut lui-même passer à la ligne : sur un
          // téléphone, libellé + valeur + barre + commentaire dépassent la
          // largeur de l'écran, et `nowrap` les ferait déborder.
          className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap text-white/40">
            {stat.label}
          </span>

          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap text-white">
              {stat.value}
            </span>
            {stat.unit && (
              <span className="text-[11px] font-semibold whitespace-nowrap text-brandCP">
                {stat.unit}
              </span>
            )}
          </span>

          {stat.barWidth && (
            <div className="h-[3px] w-[clamp(56px,9vw,110px)] overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-brandCP transition-[width] duration-700 ease-out"
                style={{ width: stat.barWidth }}
              />
            </div>
          )}

          {stat.meta && <span className="text-[11px] text-white/40">{stat.meta}</span>}

          {stat.team && stat.team.length > 0 && (
            <TeamAvatars members={stat.team} size={24} />
          )}
        </div>
      ))}
    </div>
  );
}
