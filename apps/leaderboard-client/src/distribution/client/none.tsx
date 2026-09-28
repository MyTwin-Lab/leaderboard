import type { FlowUiSlots } from '@/lib/flowSlots';

/**
 * Flow `none` — un challenge repère n'a ni onglet, ni règles, ni mesure : sa
 * page est l'écran vitrine, pour tout le monde (`showVitrineScreen`). Ces
 * slots ne servent qu'à ce que le shell n'ait rien à rendre s'il y arrive.
 */
const emptyStat = { key: 'none', label: 'Placeholder', value: '—', meta: 'nothing to join' };

export const noneSlots: FlowUiSlots = {
  contributorTabs: () => [],
  contributorHeroStat: () => emptyStat,
  manageTabs: () => [],
  manageHeroStat: () => emptyStat,
  rulesView: () => (
    <p className="py-6 text-sm" style={{ color: 'color-mix(in srgb, var(--foreground) 45%, transparent)' }}>
      A placeholder challenge has no reward rules: there is nothing to contribute to.
    </p>
  ),
};
