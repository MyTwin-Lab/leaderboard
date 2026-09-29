'use client';

import { useState } from 'react';
import { FormField, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import { AlertTriangle, Users } from 'lucide-react';
import { simulateMaxDistribution } from '@/distribution/mytwin.rules';
import {
  DEFAULT_ML_REWARD_RULES,
  ML_METRIC_NAMES,
  type MlRewardRules,
} from '../../../../../packages/database-service/domain/mlRewardRules';

import './challenge-editors-vitrine.css';

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

/** Les règles de reward d'un challenge ML, sur le vocabulaire vitrine des tiroirs. */
export function MlRewardRulesEditor({ value, pool, onChange, dense = false }: Props) {
  const rules = value ?? DEFAULT_ML_REWARD_RULES;
  const [contributors, setContributors] = useState(5);
  // Tailwind breakpoints track the viewport, not the container, so a `md:` grid
  // would still split into three inside a 512px drawer on a desktop screen.
  const gridClass = dense
    ? 'grid grid-cols-2 gap-3'
    : 'grid grid-cols-1 gap-3 md:grid-cols-3';

  // Points are awarded live from a finite pool, so a generous configuration is
  // not caught at close — it is discovered mid-challenge, once the first
  // arrivals have drained the budget. Surfacing it here is the only warning.
  const maxDistributable = simulateMaxDistribution(rules, contributors);
  const overspends = pool > 0 && maxDistributable > pool;

  const patch = (fn: (r: MlRewardRules) => MlRewardRules) => onChange(fn(rules));

  return (
    <FormSection title="ML Reward Rules">
      <p className="v-help">
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
      <div className="v-section">
        <p className="v-section-title">Model reward split</p>

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

        <p className="v-help" data-size="xs">
          The Kaggle half is <span className="v-ce-strong">reserved, not granted</span>: it scales with the metric,
          so {toPct(rules.model.kaggleShare)}% of {rules.model.cap} CP goes to a perfect score and nothing to one at
          the baseline. The rest is unlocked by the model&apos;s GitHub, scored as code.
          {rules.model.metric.baseline > 0 && (
            <> A {rules.model.metric.name.toUpperCase()} at or below {toPct(rules.model.metric.baseline)}% earns 0 -
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

        <FormField label="Block threshold (%) - optional">
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
          <p className="v-help" data-size="xs">
            Once {rules.model.metric.name.toUpperCase()} reaches {toPct(rules.model.metric.blockThreshold)}%,
            dataset and model submissions close - only API packaging stays open.
          </p>
        )}
      </div>

      {/* ── Reuse ── */}
      <div className="v-section">
        <p className="v-section-title">Reuse</p>

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

        <p className="v-help" data-size="xs">
          These shares are <span className="v-ce-strong">taken from</span> the reuser&apos;s model points, not added on
          top - the pool is unchanged. Reuse someone&apos;s dataset and earn 500 CP on your model, and
          {' '}{Math.round(500 * rules.reuse.datasetShare)} CP go to its author.
        </p>
      </div>

      {/* ── Simulation ── */}
      <div className="v-section v-ce-sim" data-warn={overspends ? 'true' : 'false'}>
        <p className="v-section-title flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          Budget simulation
        </p>

        <div className="v-field-row">
          <input
            type="number" min={1} max={100}
            value={contributors}
            onChange={e => setContributors(Math.max(1, parseInt(e.target.value) || 1))}
            className={`${inputClass} w-24`}
          />
          <span className="v-help">contributors</span>
        </div>

        <p className="v-help" data-size="xs">
          This configuration can distribute up to{' '}
          <span className={overspends ? 'v-ce-warn' : 'v-ce-strong'}>
            {maxDistributable.toLocaleString()} CP
          </span>{' '}
          against a pool of {pool.toLocaleString()} CP.
        </p>

        {overspends && (
          <p className="v-alert" data-tone="warning">
            <AlertTriangle />
            <span>
              The pool runs out before everyone is paid. Awards are clamped to whatever is left, so late contributors
              may earn nothing - raise the CP reward or lower the caps.
            </span>
          </p>
        )}
      </div>
    </FormSection>
  );
}
