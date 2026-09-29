'use client';

import { useEffect, useRef, useState } from 'react';
import { ListChecks, Loader2 } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { Field } from '@/components/admin/challengeFormFields';
import type { EvaluationGridSubcriterion } from '@packages/database-service/domain/entities';

import './evaluation-grids-vitrine.css';

export interface CriterionFormValues {
  criterion: string;
  description: string;
  weight: string;
  metrics: string;
  indicators: string;
  scoring_excellent: string;
  scoring_good: string;
  scoring_average: string;
  scoring_poor: string;
}

const EMPTY_FORM: CriterionFormValues = {
  criterion: '',
  description: '',
  weight: '',
  metrics: '',
  indicators: '',
  scoring_excellent: '',
  scoring_good: '',
  scoring_average: '',
  scoring_poor: '',
};

interface CriterionDrawerProps {
  open: boolean;
  onClose: () => void;
  criterion?: EvaluationGridSubcriterion | null; // present = edit mode
  categoryName?: string;
  saving: boolean;
  error: string;
  onSubmit: (values: CriterionFormValues) => void;
}

/** Le tiroir d'un critère de grille, sur la coque vitrine (`Drawer`). */
export function CriterionDrawer({ open, onClose, criterion, categoryName, saving, error, onSubmit }: CriterionDrawerProps) {
  const isEdit = !!criterion;
  const [form, setForm] = useState<CriterionFormValues>(EMPTY_FORM);
  const nameRef = useRef<HTMLInputElement>(null);

  // Ne se remplit qu'au passage fermé → ouvert, pour ne pas effacer la saisie
  // en cours à chaque rendu du parent.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    setForm(
      criterion
        ? {
            criterion: criterion.criterion,
            description: criterion.description ?? '',
            weight: criterion.weight != null ? String(criterion.weight) : '',
            metrics: (criterion.metrics ?? []).join(', '),
            indicators: (criterion.indicators ?? []).join(', '),
            scoring_excellent: criterion.scoring_excellent ?? '',
            scoring_good: criterion.scoring_good ?? '',
            scoring_average: criterion.scoring_average ?? '',
            scoring_poor: criterion.scoring_poor ?? '',
          }
        : EMPTY_FORM
    );
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, criterion]);

  const set = (patch: Partial<CriterionFormValues>) => setForm((p) => ({ ...p, ...patch }));

  const handleSubmit = () => {
    if (!form.criterion.trim()) return;
    onSubmit(form);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={<ListChecks />}
      title={isEdit ? 'Edit criterion' : 'New criterion'}
      subtitle={categoryName ? `in ${categoryName}` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="v-btn-text">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !form.criterion.trim()} className="v-btn">
            {saving && <Loader2 className="v-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add criterion'}
          </button>
        </>
      }
    >
      <div className="v-eg-title">
        <input
          ref={nameRef}
          value={form.criterion}
          onChange={(e) => set({ criterion: e.target.value })}
          placeholder="Criterion name…"
        />
        <div className="v-eg-title-line" />
      </div>

      <Field label="Description">
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} />
      </Field>

      <Field label="Weight (optional, 0-1)">
        <input type="number" step="0.01" min="0" max="1" value={form.weight} onChange={(e) => set({ weight: e.target.value })} />
      </Field>

      <div className="v-fields">
        <Field label="Metrics (comma-separated)">
          <input value={form.metrics} onChange={(e) => set({ metrics: e.target.value })} placeholder="LOC, complexity, coverage" />
        </Field>
        <Field label="Indicators (comma-separated)">
          <input
            value={form.indicators}
            onChange={(e) => set({ indicators: e.target.value })}
            placeholder="readability, maintainability"
          />
        </Field>
      </div>

      <Field label="Scoring guide (0-9 scale)">
        <div className="v-eg-scoring">
          <ScoringInput label="🟢 Excellent" placeholder="8-9" value={form.scoring_excellent} onChange={(v) => set({ scoring_excellent: v })} />
          <ScoringInput label="🔵 Good" placeholder="5-7" value={form.scoring_good} onChange={(v) => set({ scoring_good: v })} />
          <ScoringInput label="🟡 Average" placeholder="2-4" value={form.scoring_average} onChange={(v) => set({ scoring_average: v })} />
          <ScoringInput label="🔴 Poor" placeholder="0-1" value={form.scoring_poor} onChange={(v) => set({ scoring_poor: v })} />
        </div>
      </Field>

      {error && <p className="v-alert">{error}</p>}
    </Drawer>
  );
}

function ScoringInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="v-field">
      <span className="v-eg-scoring-label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
