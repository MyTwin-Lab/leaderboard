import { ArrowDown, Lock, Trophy, Users } from 'lucide-react';
import { parseMlRewardRules } from '../../../../../../packages/database-service/domain/mlRewardRules';
import type { RulesChallenge } from '@/lib/flowSlots';
import { FlowArrow, FlowBox, SectionLabel, pct } from './RuleFlow';

export function MlRules({ challenge }: { challenge: RulesChallenge }) {
  const rules = parseMlRewardRules(challenge.reward_rules);
  if (!rules) {
    return <p className="v-help">No reward rules configured for this challenge yet.</p>;
  }

  const kaggleShare = pct(rules.model.kaggleShare);
  const codeShare = 100 - kaggleShare;
  const baseline = pct(rules.model.metric.baseline);
  const threshold = rules.model.metric.blockThreshold != null ? pct(rules.model.metric.blockThreshold) : null;
  const datasetShare = pct(rules.reuse.datasetShare);
  const modelShare = pct(rules.reuse.modelShare);
  const minKeep = pct(rules.reuse.minKeepShare);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>How points are earned</SectionLabel>
        <div className="v-co-flow">
          <FlowBox icon={<span>📊</span>} title="Dataset">
            Scored by the evaluator - up to <b>{rules.dataset.cap} CP</b>.
            Reusing someone else&apos;s dataset earns nothing here.
          </FlowBox>
          <FlowArrow />
          <FlowBox icon={<span>🧠</span>} title="Model">
            Kaggle metric ({rules.model.metric.name.toUpperCase()}) is worth <b>{kaggleShare}%</b> of{' '}
            <b>{rules.model.cap} CP</b>; the GitHub code (evaluator score) is worth the
            remaining <b>{codeShare}%</b>.
            {baseline > 0 && <> A metric at or below <b>{baseline}%</b> earns 0.</>}
            {rules.model.beatBestBonus > 0 && (
              <div className="v-co-flow-bonus">
                <Trophy />
                +{rules.model.beatBestBonus} CP flat for the first submission to beat the challenge&apos;s record.
              </div>
            )}
          </FlowBox>
          {threshold != null && (
            <>
              <FlowArrow />
              <FlowBox icon={<Lock />} title="Threshold" tone="warning">
                Once {rules.model.metric.name.toUpperCase()} reaches <b>{threshold}%</b>,
                Dataset and Model submissions close - only API Packaging stays open.
              </FlowBox>
            </>
          )}
          <FlowArrow />
          <FlowBox icon={<span>📦</span>} title="API Packaging">
            Scored by the evaluator as code - up to <b>{rules.apiPackaging.cap} CP</b>.
            Always open, even past the threshold above.
          </FlowBox>
        </div>
      </div>

      <div>
        <SectionLabel>Reuse - shared with whoever you build on</SectionLabel>
        <div className="v-co-reuse">
          <div className="v-co-reuse-head">
            <Users />
            <span>Your model reward</span>
          </div>
          <div className="v-co-reuse-line">
            <ArrowDown style={{ transform: 'rotate(-90deg)' }} />
            <span>
              <b>{datasetShare}%</b> to the reused dataset&apos;s author
            </span>
          </div>
          <div className="v-co-reuse-line">
            <ArrowDown style={{ transform: 'rotate(-90deg)' }} />
            <span>
              <b>{modelShare}%</b> to the reused model&apos;s (GitHub) author
            </span>
          </div>
          <p className="v-co-reuse-foot">
            You always keep at least {minKeep}% of your gross reward, however many artifacts you reuse.
          </p>
        </div>
      </div>
    </div>
  );
}
