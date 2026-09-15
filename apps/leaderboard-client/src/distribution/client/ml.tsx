import { BrainCircuit } from 'lucide-react';
import { flowConfigView } from '@/lib/flowConfig';
import type { FlowUiSlots } from '@/lib/flowSlots';
import { MLChallengeFlow } from '@/components/challenges/MLChallengeFlow';
import { ChallengeMetrics } from '@/components/challenges/shared/ChallengeMetrics';
import { ComputeRequestsPanel } from '@/components/challenges/ComputeRequestsPanel';
import { MlSubmissionsTab } from '@/components/challenges/manage/MlSubmissionsTab';
import { MlRules } from '@/components/challenges/rules/MlRules';

function SubmissionTab({ challengeId }: { challengeId: string }) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
        <BrainCircuit className="h-3.5 w-3.5 text-primary-100/35" />
        ML Submission
      </h2>
      <MLChallengeFlow challengeId={challengeId} />
    </div>
  );
}

function metricStat(value: number | null, label: string | null) {
  return {
    key: 'metric',
    label: label ? `Best ${label}` : 'Best metric',
    value: value !== null ? value.toFixed(3) : '-',
    meta: value !== null ? 'from submitted model versions' : 'no metric yet',
    barWidth: value !== null ? `${Math.round(value * 100)}%` : undefined,
  };
}

const METRIC_PRIORITY = ['auc', 'f1', 'accuracy'] as const;
const METRIC_LABELS: Record<(typeof METRIC_PRIORITY)[number], string> = { auc: 'AUC', f1: 'F1', accuracy: 'Accuracy' };

/**
 * Best reported model metric across every submitted Kaggle model version. Not
 * every challenge reports AUC (some only have F1 or accuracy), so this picks
 * whichever of the three is present, in that priority order.
 */
function bestKaggleMetric(repoActivity: Record<string, any> | null): { value: number | null; label: string | null } {
  const modelEntry = repoActivity ? Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model') : undefined;
  const versions: any[] = ((modelEntry as any)?.modelVersions ?? []).flatMap((m: any) => m.versions ?? []);
  const key = METRIC_PRIORITY.find(k => versions.some(v => v.metrics?.[k] !== undefined && v.metrics?.[k] !== null));
  if (!key) return { value: null, label: null };
  const value = versions.reduce((best: number | null, v: any) => {
    const val = v.metrics?.[key] !== undefined && v.metrics?.[key] !== null ? Number(v.metrics[key]) : NaN;
    return !Number.isNaN(val) && (best === null || val > best) ? val : best;
  }, null as number | null);
  return { value, label: METRIC_LABELS[key] };
}

/** Flow ML : soumissions par étape, métriques Kaggle, puissance de calcul (extension compute). */
export const mlSlots: FlowUiSlots = {
  readsRewards: true,
  rewardBreakdown: true,

  contributorTabs: (ctx) => [
    { label: 'Submission', panel: <SubmissionTab challengeId={ctx.challengeId} /> },
    { label: 'Metrics', panel: <ChallengeMetrics repoActivity={ctx.repoActivity} /> },
  ],

  // Same source as MLChallengeFlow's "beat the leader" timeline — the reward
  // ledger, not the live Kaggle connector, which needs real credentials.
  contributorHeroStat: (ctx) => {
    const rewards = ctx.rewards;
    const value = rewards?.bestValue ?? rewards?.metric?.points?.[0] ?? null;
    return metricStat(value, rewards?.metric?.name ? rewards.metric.name.toUpperCase() : null);
  },

  // Every panel needs an account: an anonymous visitor sees the dataset and model metrics.
  anonymousView: (ctx) => <ChallengeMetrics repoActivity={ctx.repoActivity} />,

  manageTabs: (ctx) => [
    ctx.common.overview,
    { label: 'Submissions', panel: <MlSubmissionsTab challengeId={ctx.challengeId} team={ctx.team} /> },
    { label: 'Metrics', panel: <ChallengeMetrics repoActivity={ctx.repoActivity} /> },
    ctx.common.rankings,
    ...(ctx.computeConnected && flowConfigView(ctx.challenge).compute_enabled
      ? [{ label: 'Compute', panel: <ComputeRequestsPanel challengeId={ctx.challengeId} open /> }]
      : []),
  ],

  manageHeroStat: (ctx) => {
    const { value, label } = bestKaggleMetric(ctx.repoActivity);
    return metricStat(value, label);
  },

  rulesView: MlRules,
};
