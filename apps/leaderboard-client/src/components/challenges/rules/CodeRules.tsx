import { CheckCircle2, Star } from 'lucide-react';
import { parseCodeRewardRules, type CodeRewardRules } from '../../../../../../packages/database-service/domain/codeRewardRules';
import type { RulesChallenge } from '@/lib/flowSlots';
import { FlowArrow, FlowBox, SectionLabel } from './RuleFlow';

export function CodeRules({ challenge }: { challenge: RulesChallenge }) {
  const codeRules = parseCodeRewardRules(challenge.reward_rules);
  if (codeRules) {
    return <CodeRewardRulesFlow rules={codeRules} />;
  }

  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="v-co-flow">
        <FlowBox icon={<span>✅</span>} title="Contributions scored">
          Every contribution is graded by the evaluator (a score out of 9 per criterion).
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span>➗</span>} title="Proportional share">
          At close, your score is divided by the total score of every contribution on this challenge.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span>💰</span>} title="Your CP">
          That fraction of the <b>{challenge.contribution_points_reward} CP</b> pool is yours.
        </FlowBox>
      </div>
    </div>
  );
}

function CodeRewardRulesFlow({ rules }: { rules: CodeRewardRules }) {
  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="v-co-flow">
        <FlowBox icon={<CheckCircle2 />} title="Fixed part">
          <b>{rules.delivery.fixed} CP</b> - earned when your evaluated delivery lands.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<Star />} title="Quality cap">
          Up to <b>{rules.delivery.cap} CP</b> - × your AI score /10, delta on re-runs.
        </FlowBox>
      </div>
    </div>
  );
}
