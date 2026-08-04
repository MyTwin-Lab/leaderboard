'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Pencil, Plus, Sparkles, Loader2, CheckCircle2, Upload, FileJson } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { EvaluationGrid, EvaluationGridCategoryType } from '@packages/database-service/domain/entities';

interface GridDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (grid: EvaluationGrid) => void;
  /** Present = edit mode. Absent = create a new grid. */
  grid?: EvaluationGrid | null;
}

/** Portable JSON shape produced by GridEditor's "Export JSON" and consumed here on import. */
interface ImportedSubcriterion {
  criterion: string;
  description?: string;
  weight?: number;
  metrics?: string[];
  indicators?: string[];
  scoring_excellent?: string;
  scoring_good?: string;
  scoring_average?: string;
  scoring_poor?: string;
}

interface ImportedCategory {
  name: string;
  weight: number;
  type: EvaluationGridCategoryType;
  subcriteria: ImportedSubcriterion[];
}

const CATEGORY_TYPES: EvaluationGridCategoryType[] = ['objective', 'mixed', 'subjective', 'contextual'];

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

/** Lenient parse: this is a UX guard, not a security boundary — coerce what
 * we can, drop what we can't, only hard-fail on a missing name/slug. */
function parseImportedGrid(raw: unknown): {
  name: string;
  slug: string;
  description: string;
  instructions: string;
  categories: ImportedCategory[];
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid grid file — expected a JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const slug = typeof obj.slug === 'string' ? obj.slug.trim() : '';
  if (!name || !slug) {
    throw new Error('Invalid grid file — "name" and "slug" are required.');
  }

  const rawCategories = Array.isArray(obj.categories) ? obj.categories : [];
  const categories: ImportedCategory[] = rawCategories
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && typeof (c as any).name === 'string')
    .map((c) => {
      const rawSubs = Array.isArray(c.subcriteria) ? c.subcriteria : [];
      const subcriteria: ImportedSubcriterion[] = rawSubs
        .filter((s: unknown): s is Record<string, unknown> => typeof s === 'object' && s !== null && typeof (s as any).criterion === 'string')
        .map((s: Record<string, unknown>) => ({
          criterion: String(s.criterion).trim(),
          description: typeof s.description === 'string' ? s.description : undefined,
          weight: typeof s.weight === 'number' ? s.weight : undefined,
          metrics: Array.isArray(s.metrics) ? s.metrics.filter((m): m is string => typeof m === 'string') : undefined,
          indicators: Array.isArray(s.indicators) ? s.indicators.filter((i): i is string => typeof i === 'string') : undefined,
          scoring_excellent: typeof s.scoring_excellent === 'string' ? s.scoring_excellent : undefined,
          scoring_good: typeof s.scoring_good === 'string' ? s.scoring_good : undefined,
          scoring_average: typeof s.scoring_average === 'string' ? s.scoring_average : undefined,
          scoring_poor: typeof s.scoring_poor === 'string' ? s.scoring_poor : undefined,
        }));
      return {
        name: String(c.name).trim(),
        weight: typeof c.weight === 'number' ? c.weight : 0,
        type: CATEGORY_TYPES.includes(c.type as EvaluationGridCategoryType) ? (c.type as EvaluationGridCategoryType) : 'objective',
        subcriteria,
      };
    });

  return {
    name,
    slug,
    description: typeof obj.description === 'string' ? obj.description : '',
    instructions: typeof obj.instructions === 'string' ? obj.instructions : '',
    categories,
  };
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
  const [importedCategories, setImportedCategories] = useState<ImportedCategory[]>([]);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
    setImportedCategories([]);
    setImportProgress(null);
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseImportedGrid(JSON.parse(text));
      setName(parsed.name);
      setSlug(parsed.slug);
      setSlugTouched(true);
      setDescription(parsed.description);
      setInstructions(parsed.instructions);
      setImportedCategories(parsed.categories);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file as a valid grid JSON.');
    }
  };

  /** Sequentially recreates imported categories/subcriteria on a freshly
   * created grid, via the same nested REST routes the drawers use manually.
   * Best-effort: a failure here is surfaced as a warning toast, not a hard
   * error — the grid itself is already created, so the admin lands in the
   * editor and can fix up whatever didn't make it rather than being stuck. */
  const applyImportedCategories = async (gridId: string) => {
    const total = importedCategories.length;
    let done = 0;
    let failures = 0;
    setImportProgress({ done: 0, total });

    for (const cat of importedCategories) {
      try {
        const catRes = await fetch(`/api/evaluation-grids/${gridId}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cat.name, weight: cat.weight, type: cat.type, position: done }),
        });
        if (!catRes.ok) throw new Error();
        const createdCat = await catRes.json();

        for (let i = 0; i < cat.subcriteria.length; i++) {
          const sub = cat.subcriteria[i];
          const subRes = await fetch(`/api/evaluation-grids/${gridId}/categories/${createdCat.uuid}/subcriteria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sub, position: i }),
          });
          if (!subRes.ok) failures++;
        }
      } catch {
        failures++;
      }
      done++;
      setImportProgress({ done, total });
    }

    if (failures > 0) {
      toast(`Grid created — ${failures} imported item(s) failed and may need to be re-added manually.`, 'error');
    }
    setImportProgress(null);
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

      if (!isEdit && importedCategories.length > 0) {
        await applyImportedCategories(saved.uuid);
      }

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
          <div className="flex items-center gap-1.5">
            {!isEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.06]"
                  style={{ color: fgAt(0.5) }}
                  title="Import from JSON"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
              style={{ color: fgAt(0.3) }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {!isEdit && importedCategories.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-brandCP/20 bg-brandCP/[0.06] px-4 py-3">
              <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-brandCP" />
              <p className="text-xs" style={{ color: fgAt(0.6) }}>
                Imported {importedCategories.length} categor{importedCategories.length === 1 ? 'y' : 'ies'} (
                {importedCategories.reduce((sum, c) => sum + c.subcriteria.length, 0)} criteria). Review the fields
                below, then create the grid to add them.
              </p>
            </div>
          )}

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
              : importProgress
                ? `Importing ${importProgress.done}/${importProgress.total}…`
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
