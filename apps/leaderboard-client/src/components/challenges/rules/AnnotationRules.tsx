import type { RulesChallenge } from '@/lib/flowSlots';
import { FlowArrow, FlowBox, SectionLabel } from './RuleFlow';

function numberAt(record: unknown, key: string): number | null {
  const value = record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined;
  return typeof value === 'number' ? value : null;
}

export function AnnotationRules({ challenge }: { challenge: RulesChallenge }) {
  const k = numberAt(challenge.flow_config, 'k') ?? 3;
  const perUnit = numberAt(challenge.reward_rules, 'per_unit_cp') ?? 0;
  const auditRate = numberAt(challenge.reward_rules, 'audit_rate') ?? 0;

  return (
    <div>
      <SectionLabel>How points are earned</SectionLabel>
      <div className="space-y-0">
        <FlowBox icon={<span className="text-sm">🏷️</span>} title="Label one image at a time">
          Pick the answer that fits. Some images are hidden quality checks with a known answer - they look exactly like
          the others.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">💰</span>} title="Every label pays">
          <b className="text-white/80">{perUnit} CP</b> per label, multiplied by your accuracy on the hidden checks
          (100% until the first ones count).
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🗳️</span>} title="Agreement settles each image">
          Once <b className="text-white/80">{k}</b> people have labeled an image, the most frequent answer becomes its
          label. A tie sends it to a manager.
        </FlowBox>
        <FlowArrow />
        <FlowBox icon={<span className="text-sm">🔎</span>} title="Audits claw back">
          About <b className="text-white/80">{Math.round(auditRate * 100)}%</b> of settled images are audited each week:
          a label that disagreed with the agreed answer gives its CP back.
        </FlowBox>
      </div>
    </div>
  );
}
