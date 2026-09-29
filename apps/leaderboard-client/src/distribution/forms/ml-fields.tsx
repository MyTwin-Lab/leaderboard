'use client';

import { Cpu, Package } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { MlRewardRulesEditor } from '@/components/admin/MlRewardRulesEditor';
import { Field } from '@/components/admin/challengeFormFields';
import type { FlowFormSectionProps } from '@/lib/flowFormSlots';
import type { MlFormState } from './ml';

export function MlFields({ state, onChange, ctx }: FlowFormSectionProps<MlFormState>) {
  return (
    <>
      <MlRewardRulesEditor
        value={state.rewardRules}
        pool={ctx.pool}
        onChange={rewardRules => onChange({ rewardRules })}
        dense
      />

      <Field icon={<Cpu />} label="GPU compute power">
        <div className="v-switch-row">
          <div className="v-switch-text">
            <p className="v-switch-desc">Lets contributors request a Scaleway instance on this challenge</p>
          </div>
          <Toggle enabled={state.computeEnabled} onChange={computeEnabled => onChange({ computeEnabled })} />
        </div>
      </Field>

      {/* Creation only: it decides whether the API repo and step exist. */}
      {ctx.mode !== 'edit' && (
        <Field icon={<Package />} label="API Packaging step">
          <div className="v-switch-row">
            <div className="v-switch-text">
              <p className="v-switch-desc">Adds a 3rd API Packaging step on top of Dataset and Model</p>
            </div>
            <Toggle enabled={state.apiPackagingEnabled} onChange={apiPackagingEnabled => onChange({ apiPackagingEnabled })} />
          </div>
        </Field>
      )}
    </>
  );
}
