'use client';

import { Clock, Coins, ListChecks, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { Field, INPUT_CLASS, LockedValue } from '@/components/admin/challengeFormFields';
import type { FlowFormSectionProps } from '@/lib/flowFormSlots';
import { optionKeyOf, type AnnotationFormState } from './annotation';

function NumberInput({
  value, onChange, min, max, step, className = 'w-28',
}: { value: number; onChange(value: number): void; min?: number; max?: number; step?: number; className?: string }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className={`${className} ${INPUT_CLASS}`}
    />
  );
}

export function AnnotationFields({ state, onChange, ctx }: FlowFormSectionProps<AnnotationFormState>) {
  const isCreate = ctx.mode !== 'edit';
  const rules = state.rules;
  const setRules = (patch: Partial<typeof rules>) => onChange({ rules: { ...rules, ...patch } });

  const setOption = (index: number, label: string) => {
    const options = state.options.map((o, i) => (i === index ? { label, key: optionKeyOf(label) } : o));
    onChange({ options });
  };

  return (
    <>
      <Field icon={<ListChecks />} label="Label options">
        {!isCreate ? (
          <LockedValue text={state.options.map(o => o.label).join(' · ')} />
        ) : (
          <div className="v-rows">
            {state.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option.label}
                  placeholder={`Option ${index + 1}`}
                  onChange={e => setOption(index, e.target.value)}
                  className={`flex-1 ${INPUT_CLASS}`}
                />
                <code className="v-code w-28 truncate">{option.key || '—'}</code>
                <button
                  type="button"
                  aria-label="Remove option"
                  disabled={state.options.length <= 2}
                  onClick={() => onChange({ options: state.options.filter((_, i) => i !== index) })}
                  className="v-btn-icon"
                  data-tone="danger"
                >
                  <Trash2 />
                </button>
              </div>
            ))}
            {state.options.length < 12 && (
              <button
                type="button"
                onClick={() => onChange({ options: [...state.options, { key: '', label: '' }] })}
                className="v-btn-text"
                data-tone="accent"
              >
                <Plus /> Add an option
              </button>
            )}
            <p className="v-help" data-size="xs">
              2 to 12 answers. The key on the right is what golds and the export use.
            </p>
          </div>
        )}
      </Field>

      <Field icon={<Users />} label="Labels per item (k)">
        {!isCreate ? (
          <LockedValue text={`${state.k} labels per item`} />
        ) : (
          <>
            <NumberInput
              value={state.k}
              min={1}
              max={15}
              step={2}
              onChange={n => onChange({ k: n % 2 === 0 ? n + 1 : n })}
            />
            <p className="v-help" data-size="xs">
              Odd. The most frequent answer wins; a tie at the top marks the item contested.
            </p>
          </>
        )}
      </Field>

      <Field icon={<Clock />} label="Claim lifetime (hours)">
        {!isCreate ? (
          <LockedValue text={`${state.ttlHours} h`} />
        ) : (
          <NumberInput value={state.ttlHours} min={1} max={720} onChange={ttlHours => onChange({ ttlHours })} />
        )}
      </Field>

      <Field icon={<ShieldAlert />} label="Sensitive items clearance">
        {!isCreate ? (
          <LockedValue text={`${state.minSeen} hidden checks, ${Math.round(state.minAccuracy * 100)}% accuracy`} />
        ) : (
          <div className="v-field-row v-help">
            At least
            <NumberInput value={state.minSeen} min={0} className="w-20" onChange={minSeen => onChange({ minSeen })} />
            hidden checks and
            <NumberInput
              value={Math.round(state.minAccuracy * 100)}
              min={0}
              max={100}
              className="w-20"
              onChange={pct => onChange({ minAccuracy: pct / 100 })}
            />
            % accuracy
          </div>
        )}
      </Field>

      <Field icon={<Coins />} label="Pay">
        <div className="v-fields">
          <label className="v-field">
            <span className="v-field-label">CP per label</span>
            <NumberInput value={rules.per_unit_cp} min={0} className="w-full" onChange={per_unit_cp => setRules({ per_unit_cp })} />
          </label>
          <label className="v-field">
            <span className="v-field-label">Hidden checks (%)</span>
            <NumberInput
              value={Math.round(rules.gold_rate * 100)}
              min={0}
              max={100}
              className="w-full"
              onChange={pct => setRules({ gold_rate: pct / 100 })}
            />
          </label>
          <label className="v-field">
            <span className="v-field-label">Audited items (%)</span>
            <NumberInput
              value={Math.round(rules.audit_rate * 100)}
              min={0}
              max={100}
              className="w-full"
              onChange={pct => setRules({ audit_rate: pct / 100 })}
            />
          </label>
        </div>
        <p className="v-help" data-size="xs">
          Each label pays CP per label × the annotator&apos;s accuracy on hidden checks. Audited labels that disagree with
          the consensus are clawed back.
        </p>
      </Field>
    </>
  );
}
