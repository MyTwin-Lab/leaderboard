import type { FlowUiSlots } from '@/lib/flowSlots';
import { ReferenceCaseAuthorPanel } from '@/components/challenges/ReferenceCaseAuthorPanel';
import { ValidationChallengeFlow } from '@/components/challenges/ValidationChallengeFlow';
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
import { ReferenceCasesOverviewPanel } from '@/components/admin/ReferenceCasesOverviewPanel';
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
import { ValidationRunsPanel } from '@/components/admin/ValidationRunsPanel';
import { ValidationRules } from '@/components/challenges/rules/ValidationRules';
import { contributionsStat } from './stats';

/** Validation d'endpoints : des relecteurs qualifiés éprouvent chaque endpoint contre un cas de référence. */
export const endpointValidationSlots: FlowUiSlots = {
  contributorTabs: (ctx) => [
    {
      label: 'Validate',
      panel: (
        <div className="space-y-4">
          <ReferenceCaseAuthorPanel challengeId={ctx.challengeId} />
          <ValidationChallengeFlow challengeId={ctx.challengeId} />
        </div>
      ),
    },
  ],
  contributorHeroStat: (ctx) => contributionsStat(ctx.contributions.length),

  manageTabs: (ctx) => [
    ctx.common.overview,
    {
      label: 'Targets',
      panel: (
        <div className="space-y-6">
          <ValidationTargetsEditor challengeId={ctx.challengeId} open />
          <ReferenceCasesOverviewPanel challengeId={ctx.challengeId} open />
          <ValidationRewardsPanel challengeId={ctx.challengeId} open />
        </div>
      ),
    },
    { label: 'Runs', panel: <ValidationRunsPanel challengeId={ctx.challengeId} open /> },
  ],
  manageHeroStat: (ctx) => contributionsStat(ctx.contributions.length),

  rulesView: ValidationRules,
};
