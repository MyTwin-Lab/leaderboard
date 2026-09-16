'use client';

import { Clock, Coins, ListChecks, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { Field, INPUT_CLASS, LockedValue, fgAt } from '@/components/admin/challengeFormFields';
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
      style={{ color: 'var(--foreground)' }}
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
      <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Label options">
        {!isCreate ? (
          <LockedValue text={state.options.map(o => o.label).join(' · ')} />
        ) : (
          <div className="space-y-2">
            {state.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option.label}
                  placeholder={`Option ${index + 1}`}
                  onChange={e => setOption(index, e.target.value)}
                  className={`flex-1 ${INPUT_CLASS}`}
                  style={{ color: 'var(--foreground)' }}
                />
                <code className="w-28 truncate text-[11px]" style={{ color: fgAt(0.35) }}>{option.key || '—'}</code>
                <button
                  type="button"
                  aria-label="Remove option"
                  disabled={state.options.length <= 2}
                  onClick={() => onChange({ options: state.options.filter((_, i) => i !== index) })}
                  className="rounded-lg p-2 disabled:opacity-30"
                  style={{ color: fgAt(0.45) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {state.options.length < 12 && (
              <button
                type="button"
                onClick={() => onChange({ options: [...state.options, { key: '', label: '' }] })}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: fgAt(0.5) }}
              >
                <Plus className="h-3.5 w-3.5" /> Add an option
              </button>
            )}
            <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
              2 to 12 answers. The key on the right is what golds and the export use.
            </p>
          </div>
        )}
      </Field>

      <Field icon={<Users className="h-3.5 w-3.5" />} label="Labels per item (k)">
        {!isCreate ? (
          <LockedValue text={`${state.k} labels per item`} />
        ) : (
          <div className="space-y-1.5">
            <NumberInput
              value={state.k}
              min={1}
              max={15}
              step={2}
              onChange={n => onChange({ k: n % 2 === 0 ? n + 1 : n })}
            />
            <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
              Odd. The most frequent answer wins; a tie at the top marks the item contested.
            </p>
          </div>
        )}
      </Field>

      <Field icon={<Clock className="h-3.5 w-3.5" />} label="Claim lifetime (hours)">
        {!isCreate ? (
          <LockedValue text={`${state.ttlHours} h`} />
        ) : (
          <NumberInput value={state.ttlHours} min={1} max={720} onChange={ttlHours => onChange({ ttlHours })} />
        )}
      </Field>

      <Field icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Sensitive items clearance">
        {!isCreate ? (
          <LockedValue text={`${state.minSeen} hidden checks, ${Math.round(state.minAccuracy * 100)}% accuracy`} />
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: fgAt(0.45) }}>
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

      <Field icon={<Coins className="h-3.5 w-3.5" />} label="Pay">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-[11px]" style={{ color: fgAt(0.4) }}>
            CP per label
            <NumberInput value={rules.per_unit_cp} min={0} className="w-full" onChange={per_unit_cp => setRules({ per_unit_cp })} />
          </label>
          <label className="space-y-1 text-[11px]" style={{ color: fgAt(0.4) }}>
            Hidden checks (%)
            <NumberInput
              value={Math.round(rules.gold_rate * 100)}
              min={0}
              max={100}
              className="w-full"
              onChange={pct => setRules({ gold_rate: pct / 100 })}
            />
          </label>
          <label className="space-y-1 text-[11px]" style={{ color: fgAt(0.4) }}>
            Audited items (%)
            <NumberInput
              value={Math.round(rules.audit_rate * 100)}
              min={0}
              max={100}
              className="w-full"
              onChange={pct => setRules({ audit_rate: pct / 100 })}
            />
          </label>
        </div>
        <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
          Each label pays CP per label × the annotator&apos;s accuracy on hidden checks. Audited labels that disagree with
          the consensus are clawed back.
        </p>
      </Field>
    </>
  );
}
