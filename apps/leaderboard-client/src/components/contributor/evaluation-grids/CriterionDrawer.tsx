'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ListChecks, Loader2 } from 'lucide-react';
import type { EvaluationGridSubcriterion } from '@packages/database-service/domain/entities';

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

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]';

export function CriterionDrawer({ open, onClose, criterion, categoryName, saving, error, onSubmit }: CriterionDrawerProps) {
  const isEdit = !!criterion;
  const [form, setForm] = useState<CriterionFormValues>(EMPTY_FORM);
  const [mounted, setMounted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Portal target only exists client-side — mount after hydration to avoid
  // an SSR/client markup mismatch.
  useEffect(() => setMounted(true), []);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const set = (patch: Partial<CriterionFormValues>) => setForm((p) => ({ ...p, ...patch }));

  const handleSubmit = () => {
    if (!form.criterion.trim()) return;
    onSubmit(form);
  };

  if (!mounted) return null;

  // Rendered through a portal into document.body: ContributorTabs always wraps
  // the active tab panel in an animated (transform) div, which would otherwise
  // become the containing block for these position:fixed elements and pin them
  // to the tab instead of the viewport.
  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              <ListChecks className="h-3.5 w-3.5 text-brandCP" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {isEdit ? 'Edit criterion' : 'New criterion'}
              </h2>
              {categoryName && (
                <p className="text-[11px]" style={{ color: fgAt(0.3) }}>
                  in {categoryName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            style={{ color: fgAt(0.3) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-1.5">
            <input
              ref={nameRef}
              value={form.criterion}
              onChange={(e) => set({ criterion: e.target.value })}
              placeholder="Criterion name…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06] transition-all focus-within:bg-brandCP/30" />
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none leading-relaxed`}
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          <Field label="Weight (optional, 0-1)">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.weight}
              onChange={(e) => set({ weight: e.target.value })}
              className={inputClass}
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Metrics (comma-separated)">
              <input
                value={form.metrics}
                onChange={(e) => set({ metrics: e.target.value })}
                placeholder="LOC, complexity, coverage"
                className={inputClass}
                style={{ color: 'var(--foreground)' }}
              />
            </Field>
            <Field label="Indicators (comma-separated)">
              <input
                value={form.indicators}
                onChange={(e) => set({ indicators: e.target.value })}
                placeholder="readability, maintainability"
                className={inputClass}
                style={{ color: 'var(--foreground)' }}
              />
            </Field>
          </div>

          <Field label="Scoring guide (0-9 scale)">
            <div className="grid grid-cols-2 gap-2">
              <ScoringInput label="🟢 Excellent" placeholder="8-9" value={form.scoring_excellent} onChange={(v) => set({ scoring_excellent: v })} />
              <ScoringInput label="🔵 Good" placeholder="5-7" value={form.scoring_good} onChange={(v) => set({ scoring_good: v })} />
              <ScoringInput label="🟡 Average" placeholder="2-4" value={form.scoring_average} onChange={(v) => set({ scoring_average: v })} />
              <ScoringInput label="🔴 Poor" placeholder="0-1" value={form.scoring_poor} onChange={(v) => set({ scoring_poor: v })} />
            </div>
          </Field>

          {error && (
            <p className="animate-slide-in rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="text-sm transition-colors" style={{ color: fgAt(0.35) }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.criterion.trim()}
            className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-6 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add criterion'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}
      >
        {label}
      </p>
      {children}
    </div>
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
    <div className="space-y-1">
      <p className="text-[10px]" style={{ color: fgAt(0.35) }}>
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm focus:border-brandCP/40 focus:outline-none"
        style={{ color: 'var(--foreground)' }}
      />
    </div>
  );
}
