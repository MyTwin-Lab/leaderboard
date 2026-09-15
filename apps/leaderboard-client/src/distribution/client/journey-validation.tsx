import type { FlowUiSlots } from '@/lib/flowSlots';
import { ScenarioChallengeFlow } from '@/components/challenges/ScenarioChallengeFlow';
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
import { ScenarioStepsEditor } from '@/components/admin/ScenarioStepsEditor';
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
import { ScenarioWalkthroughsPanel } from '@/components/admin/ScenarioWalkthroughsPanel';
import { ValidationRules } from '@/components/challenges/rules/ValidationRules';
import { contributionsStat } from './stats';

/** Parcours de scénario : des validateurs parcourent le même scénario dans chaque application déployée. */
export const journeyValidationSlots: FlowUiSlots = {
  contributorTabs: (ctx) => [
    { label: 'Walkthrough', panel: <ScenarioChallengeFlow challengeId={ctx.challengeId} /> },
  ],
  contributorHeroStat: (ctx) => contributionsStat(ctx.contributions.length),

  manageTabs: (ctx) => [
    ctx.common.overview,
    {
      label: 'Scenario',
      panel: (
        <div className="space-y-6">
          <ValidationTargetsEditor challengeId={ctx.challengeId} open />
          <ScenarioStepsEditor challengeId={ctx.challengeId} open />
          <ValidationRewardsPanel challengeId={ctx.challengeId} open />
        </div>
      ),
    },
    { label: 'Walkthroughs', panel: <ScenarioWalkthroughsPanel challengeId={ctx.challengeId} open /> },
  ],
  manageHeroStat: (ctx) => contributionsStat(ctx.contributions.length),

  rulesView: ValidationRules,
};
