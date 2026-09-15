'use client';

import { Cpu, Package } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { MlRewardRulesEditor } from '@/components/admin/MlRewardRulesEditor';
import { Field, fgAt } from '@/components/admin/challengeFormFields';
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

      <Field icon={<Cpu className="h-3.5 w-3.5" />} label="GPU compute power">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs" style={{ color: fgAt(0.4) }}>
            Lets contributors request a Scaleway instance on this challenge
          </p>
          <Toggle enabled={state.computeEnabled} onChange={computeEnabled => onChange({ computeEnabled })} />
        </div>
      </Field>

      {/* Creation only: it decides whether the API repo and step exist. */}
      {ctx.mode !== 'edit' && (
        <Field icon={<Package className="h-3.5 w-3.5" />} label="API Packaging step">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs" style={{ color: fgAt(0.4) }}>
              Adds a 3rd API Packaging step on top of Dataset and Model
            </p>
            <Toggle enabled={state.apiPackagingEnabled} onChange={apiPackagingEnabled => onChange({ apiPackagingEnabled })} />
          </div>
        </Field>
      )}
    </>
  );
}
