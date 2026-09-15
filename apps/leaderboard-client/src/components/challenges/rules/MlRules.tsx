import { ArrowDown, Lock, Trophy, Users } from 'lucide-react';
import { parseMlRewardRules } from '../../../../../../packages/database-service/domain/mlRewardRules';
import type { RulesChallenge } from '@/lib/flowSlots';
import { FlowArrow, FlowBox, SectionLabel, pct } from './RuleFlow';

export function MlRules({ challenge }: { challenge: RulesChallenge }) {
  const rules = parseMlRewardRules(challenge.reward_rules);
  if (!rules) {
    return <p className="text-xs text-white/35">No reward rules configured for this challenge yet.</p>;
  }

  const kaggleShare = pct(rules.model.kaggleShare);
  const codeShare = 100 - kaggleShare;
  const baseline = pct(rules.model.metric.baseline);
  const threshold = rules.model.metric.blockThreshold != null ? pct(rules.model.metric.blockThreshold) : null;
  const datasetShare = pct(rules.reuse.datasetShare);
  const modelShare = pct(rules.reuse.modelShare);
  const minKeep = pct(rules.reuse.minKeepShare);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>How points are earned</SectionLabel>
        <div className="space-y-0">
          <FlowBox icon={<span className="text-sm">📊</span>} title="Dataset">
            Scored by the evaluator - up to <b className="text-white/80">{rules.dataset.cap} CP</b>.
            Reusing someone else&apos;s dataset earns nothing here.
          </FlowBox>
          <FlowArrow />
          <FlowBox icon={<span className="text-sm">🧠</span>} title="Model">
            Kaggle metric ({rules.model.metric.name.toUpperCase()}) is worth <b className="text-white/80">{kaggleShare}%</b> of{' '}
            <b className="text-white/80">{rules.model.cap} CP</b>; the GitHub code (evaluator score) is worth the
            remaining <b className="text-white/80">{codeShare}%</b>.
            {baseline > 0 && <> A metric at or below <b className="text-white/80">{baseline}%</b> earns 0.</>}
            {rules.model.beatBestBonus > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-brandCP/80">
                <Trophy className="h-3 w-3 shrink-0" />
                +{rules.model.beatBestBonus} CP flat for the first submission to beat the challenge&apos;s record.
              </div>
            )}
          </FlowBox>
          {threshold != null && (
            <>
              <FlowArrow />
              <FlowBox icon={<Lock className="h-3.5 w-3.5" />} title="Threshold" tone="warning">
                Once {rules.model.metric.name.toUpperCase()} reaches <b className="text-white/80">{threshold}%</b>,
                Dataset and Model submissions close - only API Packaging stays open.
              </FlowBox>
            </>
          )}
          <FlowArrow />
          <FlowBox icon={<span className="text-sm">📦</span>} title="API Packaging">
            Scored by the evaluator as code - up to <b className="text-white/80">{rules.apiPackaging.cap} CP</b>.
            Always open, even past the threshold above.
          </FlowBox>
        </div>
      </div>

      <div>
        <SectionLabel>Reuse - shared with whoever you build on</SectionLabel>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <Users className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>Your model reward</span>
          </div>
          <div className="space-y-2 pl-1">
            <div className="flex items-center gap-2 text-xs">
              <ArrowDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-white/20" />
              <span className="text-white/55">
                <b className="text-brandCP">{datasetShare}%</b> to the reused dataset&apos;s author
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-white/20" />
              <span className="text-white/55">
                <b className="text-brandCP">{modelShare}%</b> to the reused model&apos;s (GitHub) author
              </span>
            </div>
          </div>
          <p className="border-t border-white/[0.06] pt-2 text-[11px] text-white/35">
            You always keep at least {minKeep}% of your gross reward, however many artifacts you reuse.
          </p>
        </div>
      </div>
    </div>
  );
}
