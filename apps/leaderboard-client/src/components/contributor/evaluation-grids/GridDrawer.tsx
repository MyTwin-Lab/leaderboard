'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Pencil, Plus, Sparkles, Loader2, CheckCircle2, Upload, FileJson } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { Field } from '@/components/admin/challengeFormFields';
import { useToast } from '@/components/ui/Toast';
import type { EvaluationGrid, EvaluationGridCategoryType } from '@packages/database-service/domain/entities';

import './evaluation-grids-vitrine.css';

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '-')
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
    throw new Error('Invalid grid file - expected a JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const slug = typeof obj.slug === 'string' ? obj.slug.trim() : '';
  if (!name || !slug) {
    throw new Error('Invalid grid file - "name" and "slug" are required.');
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

/** Le tiroir d'une grille — création (avec import JSON) et édition des métadonnées, sur la coque vitrine. */
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
  const [importedCategories, setImportedCategories] = useState<ImportedCategory[]>([]);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
      toast(`Grid created - ${failures} imported item(s) failed and may need to be re-added manually.`, 'error');
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

  const submitLabel = success
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
          : 'Create & add criteria';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={isEdit ? <Pencil /> : <ClipboardList />}
      title={isEdit ? 'Edit evaluation grid' : 'New evaluation grid'}
      footer={
        <>
          <button type="button" onClick={onClose} className="v-btn-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || success}
            className="v-btn"
            data-tone={success ? 'success' : undefined}
          >
            {saving && <Loader2 className="v-spin" />}
            {success && <CheckCircle2 />}
            {!isEdit && !saving && !success && <Plus />}
            {submitLabel}
          </button>
        </>
      }
    >
      {/* L'import JSON : le fichier exporté par l'éditeur, relu ici à la création. */}
      {!isEdit && (
        <div className="v-field-row" style={{ justifyContent: 'flex-end' }}>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileSelected} style={{ display: 'none' }} />
          <button type="button" onClick={handleImportClick} className="v-btn-quiet v-btn-sm" title="Import from JSON">
            <Upload />
            Import
          </button>
        </div>
      )}

      {!isEdit && importedCategories.length > 0 && (
        <div className="v-alert" data-tone="info">
          <FileJson />
          <span>
            Imported {importedCategories.length} categor{importedCategories.length === 1 ? 'y' : 'ies'} (
            {importedCategories.reduce((sum, c) => sum + c.subcriteria.length, 0)} criteria). Review the fields
            below, then create the grid to add them.
          </span>
        </div>
      )}

      <div className="v-eg-title">
        <input ref={nameRef} type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Grid name…" />
        <div className="v-eg-title-line" />
      </div>

      <Field label="Slug" hint="Used by the evaluator to pick this grid for a given contribution type.">
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value));
            setSlugTouched(true);
          }}
          placeholder="dataset"
          className="v-input"
          data-mono="true"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this grid evaluate?"
          rows={3}
        />
      </Field>

      <Field icon={<Sparkles />} label="Instructions for the AI evaluator">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Extra guidance given to the evaluator agent alongside the criteria."
          rows={4}
        />
      </Field>

      {error && <p className="v-alert">{error}</p>}
    </Drawer>
  );
}
