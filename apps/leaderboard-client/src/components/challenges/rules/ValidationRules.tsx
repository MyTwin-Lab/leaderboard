import { flowConfigView } from '@/lib/flowConfig';
import type { RulesChallenge } from '@/lib/flowSlots';
import { FlowArrow, FlowBox, SectionLabel } from './RuleFlow';

export function ValidationRules({ challenge }: { challenge: RulesChallenge }) {
  const cpPerValidation = flowConfigView(challenge).cp_per_validation;
  const required = flowConfigView(challenge).required_validations ?? 0;

  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="space-y-0">
        <FlowBox icon={<span className="text-sm">📬</span>} title="Submission exposed">
          An admin/manager picks an API packaging submission and its endpoint to test.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🗳️</span>} title="Validators test & vote">
          A qualified reviewer claims a blind reference case, records an observation,
          then votes Works or Broken once the expected output is revealed.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🏁</span>} title="Majority resolves it">
          Once <b className="text-white/80">{required}</b> votes are in, the majority side wins permanently.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">💰</span>} title="Winners get paid">
          <b className="text-white/80">{cpPerValidation} CP</b> to each validator on the winning side - the minority
          earns nothing, even for the same work.
        </FlowBox>
      </div>
    </div>
  );
}
