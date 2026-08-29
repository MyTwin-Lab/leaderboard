'use client';

import { useState } from 'react';
import { FormField, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import { AlertTriangle, Users } from 'lucide-react';
import { simulateMaxDistribution } from '../../../../../packages/evaluator/ml-reward';
import {
  DEFAULT_ML_REWARD_RULES,
  ML_METRIC_NAMES,
  type MlRewardRules,
} from '../../../../../packages/database-service/domain/mlRewardRules';

interface Props {
  value: MlRewardRules | null;
  pool: number;
  onChange: (rules: MlRewardRules) => void;
  /** Narrow containers (the manager's creation drawer) can't take three columns. */
  dense?: boolean;
}

/** Displays a 0..1 share as a percentage without dragging floats into the UI. */
const toPct = (n: number) => Math.round(n * 100);
const fromPct = (v: string) => Math.min(100, Math.max(0, parseInt(v) || 0)) / 100;

export function MlRewardRulesEditor({ value, pool, onChange, dense = false }: Props) {
  const rules = value ?? DEFAULT_ML_REWARD_RULES;
  const [contributors, setContributors] = useState(5);
  // Tailwind breakpoints track the viewport, not the container, so a `md:` grid
  // would still split into three inside a 512px drawer on a desktop screen.
  const gridClass = dense
    ? 'grid grid-cols-2 gap-4'
    : 'grid grid-cols-1 gap-4 md:grid-cols-3';

  // Points are awarded live from a finite pool, so a generous configuration is
  // not caught at close — it is discovered mid-challenge, once the first
  // arrivals have drained the budget. Surfacing it here is the only warning.
  const maxDistributable = simulateMaxDistribution(rules, contributors);
  const overspends = pool > 0 && maxDistributable > pool;

  const patch = (fn: (r: MlRewardRules) => MlRewardRules) => onChange(fn(rules));

  return (
    <FormSection title="ML Reward Rules">
      <p className="-mt-1 text-xs text-white/35">
        Points are awarded live as contributors submit, drawn from the CP reward above until it runs out.
      </p>

      <div className={gridClass}>
        <FormField label="Dataset cap">
          <input
            type="number" min={0} className={inputClass}
            value={rules.dataset.cap}
            onChange={e => patch(r => ({ ...r, dataset: { cap: parseInt(e.target.value) || 0 } }))}
          />
        </FormField>

        <FormField label="Model cap">
          <input
            type="number" min={0} className={inputClass}
            value={rules.model.cap}
            onChange={e => patch(r => ({ ...r, model: { ...r.model, cap: parseInt(e.target.value) || 0 } }))}
          />
        </FormField>

        <FormField label="API packaging cap">
          <input
            type="number" min={0} className={inputClass}
            value={rules.apiPackaging.cap}
            onChange={e => patch(r => ({ ...r, apiPackaging: { cap: parseInt(e.target.value) || 0 } }))}
          />
        </FormField>
      </div>

      {/* ── Model split ── */}
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-semibold text-white/60">Model reward split</p>

        <div className={gridClass}>
          <FormField label="Reserved for Kaggle (%)">
            <input
              type="number" min={0} max={100} className={inputClass}
              value={toPct(rules.model.kaggleShare)}
              onChange={e => patch(r => ({ ...r, model: { ...r.model, kaggleShare: fromPct(e.target.value) } }))}
            />
          </FormField>

          <FormField label="Metric">
            <select
              className={selectClass}
              value={rules.model.metric.name}
              onChange={e => patch(r => ({
                ...r,
                model: { ...r.model, metric: { ...r.model.metric, name: e.target.value as typeof ML_METRIC_NAMES[number] } },
              }))}
            >
              {ML_METRIC_NAMES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </FormField>

          <FormField label="Baseline (%)">
            <input
              type="number" min={0} max={99} className={inputClass}
              value={toPct(rules.model.metric.baseline)}
              onChange={e => patch(r => ({
                ...r,
                model: { ...r.model, metric: { ...r.model.metric, baseline: fromPct(e.target.value) } },
              }))}
            />
          </FormField>
        </div>

        <p className="text-xs text-white/30">
          The Kaggle half is <span className="text-white/50">reserved, not granted</span>: it scales with the metric,
          so {toPct(rules.model.kaggleShare)}% of {rules.model.cap} CP goes to a perfect score and nothing to one at
          the baseline. The rest is unlocked by the model&apos;s GitHub, scored as code.
          {rules.model.metric.baseline > 0 && (
            <> A {rules.model.metric.name.toUpperCase()} at or below {toPct(rules.model.metric.baseline)}% earns 0 —
            without it, a coin-flip model would collect {Math.round(rules.model.cap * rules.model.kaggleShare * 0.5)} CP
            for free.</>
          )}
        </p>

        <FormField label="Beat-best bonus">
          <input
            type="number" min={0} className={inputClass}
            value={rules.model.beatBestBonus}
            onChange={e => patch(r => ({ ...r, model: { ...r.model, beatBestBonus: parseInt(e.target.value) || 0 } }))}
          />
        </FormField>

        <FormField label="Block threshold (%) — optional">
          <input
            type="number" min={0} max={100} className={inputClass}
            value={rules.model.metric.blockThreshold != null ? toPct(rules.model.metric.blockThreshold) : ''}
            placeholder="No threshold"
            onChange={e => patch(r => ({
              ...r,
              model: { ...r.model, metric: {
                ...r.model.metric,
                blockThreshold: e.target.value === '' ? undefined : fromPct(e.target.value),
              } },
            }))}
          />
        </FormField>
        {rules.model.metric.blockThreshold != null && (
          <p className="text-xs text-white/30">
            Once {rules.model.metric.name.toUpperCase()} reaches {toPct(rules.model.metric.blockThreshold)}%,
            dataset and model submissions close — only API packaging stays open.
          </p>
        )}
      </div>

      {/* ── Reuse ── */}
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-semibold text-white/60">Reuse</p>

        <div className={gridClass}>
          <FormField label="Dataset share (%)">
            <input
              type="number" min={0} max={100} className={inputClass}
              value={toPct(rules.reuse.datasetShare)}
              onChange={e => patch(r => ({ ...r, reuse: { ...r.reuse, datasetShare: fromPct(e.target.value) } }))}
            />
          </FormField>

          <FormField label="Model share (%)">
            <input
              type="number" min={0} max={100} className={inputClass}
              value={toPct(rules.reuse.modelShare)}
              onChange={e => patch(r => ({ ...r, reuse: { ...r.reuse, modelShare: fromPct(e.target.value) } }))}
            />
          </FormField>

          <FormField label="Reuser keeps at least (%)">
            <input
              type="number" min={0} max={100} className={inputClass}
              value={toPct(rules.reuse.minKeepShare)}
              onChange={e => patch(r => ({ ...r, reuse: { ...r.reuse, minKeepShare: fromPct(e.target.value) } }))}
            />
          </FormField>
        </div>

        <p className="text-xs text-white/30">
          These shares are <span className="text-white/50">taken from</span> the reuser&apos;s model points, not added on
          top — the pool is unchanged. Reuse someone&apos;s dataset and earn 500 CP on your model, and
          {' '}{Math.round(500 * rules.reuse.datasetShare)} CP go to its author.
        </p>
      </div>

      {/* ── Simulation ── */}
      <div className={`space-y-2 rounded-xl border p-4 ${
        overspends ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'
      }`}>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-white/40" />
          <p className="text-xs font-semibold text-white/60">Budget simulation</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={100}
            value={contributors}
            onChange={e => setContributors(Math.max(1, parseInt(e.target.value) || 1))}
            className={`${inputClass} w-20`}
          />
          <span className="text-xs text-white/40">contributors</span>
        </div>

        <p className="text-xs text-white/40">
          This configuration can distribute up to{' '}
          <span className={overspends ? 'font-semibold text-amber-300' : 'font-semibold text-white/70'}>
            {maxDistributable.toLocaleString()} CP
          </span>{' '}
          against a pool of {pool.toLocaleString()} CP.
        </p>

        {overspends && (
          <p className="flex items-start gap-1.5 text-xs text-amber-300/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The pool runs out before everyone is paid. Awards are clamped to whatever is left, so late contributors
            may earn nothing — raise the CP reward or lower the caps.
          </p>
        )}
      </div>
    </FormSection>
  );
}
