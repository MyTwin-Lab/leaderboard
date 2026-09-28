import type { HeroStat } from '@/components/challenges/HeroStats';

/** La mesure des flows sans board ni métrique : les contributions enregistrées. */
export function contributionsStat(count: number): HeroStat {
  return {
    key: 'contributions',
    label: 'Contributions',
    value: String(count),
    meta: 'submissions & verdicts recorded',
  };
}
