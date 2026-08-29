'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderTree, Loader2, Scale, Boxes } from 'lucide-react';
import type { EvaluationGridCategory, EvaluationGridCategoryType } from '@packages/database-service/domain/entities';

export interface CategoryFormValues {
  name: string;
  weightPercent: number;
  type: EvaluationGridCategoryType;
}

interface CategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  category?: EvaluationGridCategory | null; // present = edit mode
  saving: boolean;
  error: string;
  onSubmit: (values: CategoryFormValues) => void;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

const TYPE_OPTIONS: { value: EvaluationGridCategoryType; label: string; desc: string }[] = [
  { value: 'objective', label: 'Objective', desc: 'Measured directly (tests, metrics)' },
  { value: 'mixed', label: 'Mixed', desc: 'Part measured, part judged' },
  { value: 'subjective', label: 'Subjective', desc: 'Reviewer judgment' },
  { value: 'contextual', label: 'Contextual', desc: 'Depends on the challenge' },
];

export function CategoryDrawer({ open, onClose, category, saving, error, onSubmit }: CategoryDrawerProps) {
  const isEdit = !!category;
  const [name, setName] = useState('');
  const [weightPercent, setWeightPercent] = useState(25);
  const [type, setType] = useState<EvaluationGridCategoryType>('objective');
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

    setName(category?.name ?? '');
    setWeightPercent(category ? Math.round(category.weight * 100) : 25);
    setType(category?.type ?? 'objective');
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, category]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), weightPercent, type });
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
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              <FolderTree className="h-3.5 w-3.5 text-brandCP" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {isEdit ? 'Edit category' : 'New category'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            style={{ color: fgAt(0.3) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          <div className="space-y-1.5">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06] transition-all focus-within:bg-brandCP/30" />
          </div>

          <Field icon={<Scale className="h-3.5 w-3.5" />} label="Weight">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                value={weightPercent}
                onChange={(e) => setWeightPercent(Number(e.target.value))}
                className="flex-1 accent-brandCP"
              />
              <div className="flex w-16 items-baseline justify-end gap-1">
                <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {weightPercent}
                </span>
                <span className="text-sm font-semibold text-brandCP">%</span>
              </div>
            </div>
          </Field>

          <Field icon={<Boxes className="h-3.5 w-3.5" />} label="Type">
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                      active
                        ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <p className="text-sm font-semibold" style={{ color: active ? 'var(--foreground)' : fgAt(0.5) }}>
                      {opt.label}
                    </p>
                    <p className="text-[10px]" style={{ color: fgAt(0.3) }}>
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
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
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-6 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}
      >
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}
