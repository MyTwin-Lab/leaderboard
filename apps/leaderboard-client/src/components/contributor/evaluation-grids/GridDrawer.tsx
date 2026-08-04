'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Pencil, Plus, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import type { EvaluationGrid } from '@packages/database-service/domain/entities';

interface GridDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (grid: EvaluationGrid) => void;
  /** Present = edit mode. Absent = create a new grid. */
  grid?: EvaluationGrid | null;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function GridDrawer({ open, onClose, onSaved, grid }: GridDrawerProps) {
  const isEdit = !!grid;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Portal target only exists client-side — mount after hydration to avoid
  // an SSR/client markup mismatch.
  useEffect(() => setMounted(true), []);

  // Fires on the false → true transition only, so we don't wipe in-progress
  // typing on unrelated parent re-renders. A freshly spread `grid` object on
  // every render would otherwise refill the form on each keystroke.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    setError('');
    setSuccess(false);
    if (grid) {
      setName(grid.name);
      setSlug(grid.slug);
      setSlugTouched(true);
      setDescription(grid.description ?? '');
      setInstructions(grid.instructions ?? '');
    } else {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      setInstructions('');
    }
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, grid]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(isEdit ? `/api/evaluation-grids/${grid!.uuid}` : '/api/evaluation-grids', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Failed to ${isEdit ? 'update' : 'create'} grid`);
        return;
      }
      const saved: EvaluationGrid = await res.json();
      setSuccess(true);
      setTimeout(() => {
        onSaved(saved);
        onClose();
      }, 700);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  // Rendered through a portal into document.body: ContributorTabs always wraps
  // the active tab panel in an animated (transform) div, which would otherwise
  // become the containing block for these position:fixed elements and pin them
  // to the tab instead of the viewport.
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              {isEdit ? (
                <Pencil className="h-3.5 w-3.5 text-brandCP" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5 text-brandCP" />
              )}
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {isEdit ? 'Edit evaluation grid' : 'New evaluation grid'}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Name */}
          <div className="space-y-1.5">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Grid name…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06] transition-all focus-within:bg-brandCP/30" />
          </div>

          {/* Slug */}
          <Field label="Slug">
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="dataset"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)' }}
            />
            <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
              Used by the evaluator to pick this grid for a given contribution type.
            </p>
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this grid evaluate?"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          {/* AI instructions */}
          <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Instructions for the AI evaluator">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Extra guidance given to the evaluator agent alongside the criteria."
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          {error && (
            <p className="animate-slide-in rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="text-sm transition-colors" style={{ color: fgAt(0.35) }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || success}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
              success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-brandCP/20 text-brandCP hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)]'
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {success && <CheckCircle2 className="h-4 w-4" />}
            {!isEdit && !saving && !success && <Plus className="h-4 w-4" />}
            {success
              ? isEdit
                ? 'Saved!'
                : 'Created!'
              : saving
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save changes'
                  : 'Create & add criteria'}
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
