'use client';

import { FormField, FormSection, inputClass } from '@/components/ui/FormField';
import {
  DEFAULT_CODE_REWARD_RULES,
  type CodeRewardRules,
} from '../../../../../packages/database-service/domain/codeRewardRules';

import './challenge-editors-vitrine.css';

interface Props {
  value: CodeRewardRules | null;
  pool: number;
  onChange: (rules: CodeRewardRules) => void;
}

/** Les règles de reward d'un challenge code, sur le vocabulaire vitrine des tiroirs. */
export function CodeRewardRulesEditor({ value, pool, onChange }: Props) {
  const rules = value ?? DEFAULT_CODE_REWARD_RULES;
  const perContributorMax = rules.delivery.fixed + rules.delivery.cap;

  return (
    <FormSection title="Code Reward Rules">
      <p className="v-help">
        Each contributor delivers the whole project. A run pays the fixed part once,
        plus cap × AI score / 10 - re-runs only pay the positive delta.
      </p>

      <div className="v-fields">
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

      <p className="v-help" data-size="xs">
        A perfect delivery earns <span className="v-ce-strong">{perContributorMax} CP</span>. The {pool.toLocaleString()} CP pool funds about{' '}
        {perContributorMax > 0 ? Math.floor(pool / perContributorMax) : '∞'} full-score contributors - first come,
        first served, awards are clamped to what is left.
      </p>
    </FormSection>
  );
}
