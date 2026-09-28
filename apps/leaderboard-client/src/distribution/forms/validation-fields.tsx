'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Trophy } from 'lucide-react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
import { Field, INPUT_CLASS, LockedValue, fgAt } from '@/components/admin/challengeFormFields';
import type { FlowFormSectionProps } from '@/lib/flowFormSlots';
import { flowCatalog } from '../mytwin.flows';
import { VALIDATION_FLOW_BY_SOURCE, isScenarioValidation, type ValidationFormState } from './validation';

interface SourceChallenge {
  id: string;
  title: string;
  type: string;
}

export function ValidationFields({ state, onChange, ctx }: FlowFormSectionProps<ValidationFormState>) {
  const [sources, setSources] = useState<SourceChallenge[]>([]);
  const isCreate = ctx.mode === 'create';
  const scenario = isScenarioValidation(state, ctx);

  // Le sélecteur de source ne sert qu'à la création. Seuls les challenges dont
  // un flow de validation sait éprouver les livrables y figurent.
  useEffect(() => {
    if (!isCreate || !ctx.open) return;
    fetch('/api/challenges')
      .then(r => r.ok ? r.json() : [])
      .then((all: any[]) => setSources(
        (Array.isArray(all) ? all : [])
          .filter(c => VALIDATION_FLOW_BY_SOURCE[c.type])
          .map(c => ({ id: c.uuid, title: c.title, type: c.type }))
      ))
      .catch(() => {});
  }, [isCreate, ctx.open]);

  return (
    <>
      <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Source challenge">
        {!isCreate ? (
          <LockedValue text="Source challenge" />
        ) : (
          <>
            <SelectDropdown
              options={sources.map(c => ({ value: c.id, label: `${c.title} · ${flowCatalog.resolve(c.type).label}` }))}
              value={state.sourceChallengeId}
              onChange={id => onChange({ sourceChallengeId: id, sourceType: sources.find(c => c.id === id)?.type ?? null })}
            />
            <p className="text-[11px] mt-1.5" style={{ color: fgAt(0.25) }}>
              {scenario
                ? 'A Code challenge: validators walk a scenario through each deployed application.'
                : 'An ML challenge: validators test each endpoint against a ground-truth reference case.'}
              {' '}Only challenges without a validation challenge yet will actually save - the API rejects duplicates.
            </p>
          </>
        )}
      </Field>

      <Field icon={<Trophy className="h-3.5 w-3.5" />} label="CP per validation">
        {!isCreate ? (
          <LockedValue text={`${state.cpPerValidation} CP`} />
        ) : (
          <input
            type="number"
            min={1}
            value={state.cpPerValidation}
            onChange={e => onChange({ cpPerValidation: Math.max(1, parseInt(e.target.value) || 1) })}
            className={`w-28 ${INPUT_CLASS}`}
            style={{ color: 'var(--foreground)' }}
          />
        )}
      </Field>

      {/* No quorum in scenario mode: nothing resolves by majority. */}
      {!scenario && (
        <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Required validations">
          {!isCreate ? (
            <LockedValue text={`${state.requiredValidations} validators must agree`} />
          ) : (
            <div className="space-y-1.5">
              <input
                type="number"
                min={1}
                step={2}
                value={state.requiredValidations}
                onChange={e => {
                  const n = parseInt(e.target.value) || 1;
                  onChange({ requiredValidations: n % 2 === 0 ? n + 1 : n });
                }}
                className={`w-28 ${INPUT_CLASS}`}
                style={{ color: 'var(--foreground)' }}
              />
              <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
                Must be odd - majority wins once this many validators have voted.
              </p>
            </div>
          )}
        </Field>
      )}
    </>
  );
}

/** Edit only: targets and rewards are independent CRUD on the existing challenge. */
export function ValidationDetails({ ctx }: FlowFormSectionProps<ValidationFormState>) {
  if (ctx.mode !== 'edit') return null;
  return (
    <>
      <ValidationTargetsEditor challengeId={ctx.challenge!.uuid} open={ctx.open} />
      <div className="mt-3">
        <ValidationRewardsPanel challengeId={ctx.challenge!.uuid} open={ctx.open} />
      </div>
    </>
  );
}
