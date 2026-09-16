import type { HeroStat } from '@/components/challenges/HeroStats';
import type { ChallengeRewards, FlowUiSlots } from '@/lib/flowSlots';
import { AnnotationWorkbench } from '@/components/challenges/AnnotationWorkbench';
import { AnnotationCampaignPanel } from '@/components/admin/AnnotationCampaignPanel';
import { AnnotationRules } from '@/components/challenges/rules/AnnotationRules';

/** La mesure du hero : les items labellisés sur le total importé (`rewards.summarize` du flow). */
function labeledStat(rewards: ChallengeRewards | null): HeroStat {
  const total = typeof rewards?.items_total === 'number' ? rewards.items_total : 0;
  const labeled = typeof rewards?.items_labeled === 'number' ? rewards.items_labeled : 0;
  return {
    key: 'labeled',
    label: 'Labeled',
    value: String(labeled),
    unit: `/ ${total}`,
    meta: 'items settled by agreement',
    barWidth: total > 0 ? `${Math.round((labeled / total) * 100)}%` : '0%',
  };
}

/** Annotation : une image à la fois, des cas de contrôle cachés, l'accord qui tranche. */
export const dataAnnotationSlots: FlowUiSlots = {
  readsRewards: true,

  contributorTabs: (ctx) => [
    { label: 'Label', panel: <AnnotationWorkbench challengeId={ctx.challengeId} isMember={ctx.isMember} /> },
  ],
  contributorHeroStat: (ctx) => labeledStat(ctx.rewards),

  // Aucune image n'est montrée hors adhésion : le brief suffit.
  anonymousView: () => (
    <p className="py-6 text-sm" style={{ color: 'color-mix(in srgb, var(--foreground) 45%, transparent)' }}>
      Sign in and join the challenge to start labeling.
    </p>
  ),

  manageTabs: (ctx) => [
    ctx.common.overview,
    { label: 'Campaign', panel: <AnnotationCampaignPanel challengeId={ctx.challengeId} /> },
    ctx.common.rankings,
  ],
  manageHeroStat: (ctx) => labeledStat(ctx.rewards),

  rulesView: AnnotationRules,
};
