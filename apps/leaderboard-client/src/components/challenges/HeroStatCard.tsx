'use client';

import { TeamAvatars } from '@/components/ui/TeamAvatars';
import type { TeamMember } from '@/lib/types';

/** One stat card in the challenge hero's stat grid — CP awarded, tasks/AUC/verdicts, team. */
export function HeroStatCard({
  label, value, unit, meta, barWidth, team,
}: {
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  barWidth?: string;
  team?: TeamMember[];
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-4">
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {unit && <span className="text-xs font-semibold text-brandCP">{unit}</span>}
      </div>
      {meta && <span className="text-xs text-white/35">{meta}</span>}
      {barWidth && (
        <div className="h-[5px] overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brandCP/50 to-brandCP transition-[width] duration-700 ease-out"
            style={{ width: barWidth }}
          />
        </div>
      )}
      {team && team.length > 0 && (
        <div className="pt-0.5">
          <TeamAvatars members={team} variant="floating" size={26} />
        </div>
      )}
    </div>
  );
}
