'use client';

import { FormField, FormSection, inputClass } from '@/components/ui/FormField';
import {
  DEFAULT_CODE_REWARD_RULES,
  type CodeRewardRules,
} from '../../../../../packages/database-service/domain/codeRewardRules';

interface Props {
  value: CodeRewardRules | null;
  pool: number;
  onChange: (rules: CodeRewardRules) => void;
}

export function CodeRewardRulesEditor({ value, pool, onChange }: Props) {
  const rules = value ?? DEFAULT_CODE_REWARD_RULES;
  const perContributorMax = rules.delivery.fixed + rules.delivery.cap;

  return (
    <FormSection title="Code Reward Rules">
      <p className="-mt-1 text-xs text-white/35">
        Each contributor delivers the whole project. A run pays the fixed part once,
        plus cap × AI score / 10 — re-runs only pay the positive delta.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fixed part">
          <input
            type="number" min={0} className={inputClass}
            value={rules.delivery.fixed}
            onChange={e => onChange({ ...rules, delivery: { ...rules.delivery, fixed: parseInt(e.target.value) || 0 } })}
          />
        </FormField>
        <FormField label="Quality cap">
          <input
            type="number" min={0} className={inputClass}
            value={rules.delivery.cap}
            onChange={e => onChange({ ...rules, delivery: { ...rules.delivery, cap: parseInt(e.target.value) || 0 } })}
          />
        </FormField>
      </div>

      <p className="text-xs text-white/30">
        A perfect delivery earns {perContributorMax} CP. The {pool.toLocaleString()} CP pool funds about{' '}
        {perContributorMax > 0 ? Math.floor(pool / perContributorMax) : '∞'} full-score contributors — first come,
        first served, awards are clamped to what is left.
      </p>
    </FormSection>
  );
}
