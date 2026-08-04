'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Download, FlaskConical, Loader2, Pencil, Plus, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { GridDrawer } from './GridDrawer';
import { CategoryDrawer, type CategoryFormValues } from './CategoryDrawer';
import { CriterionDrawer, type CriterionFormValues } from './CriterionDrawer';
import type {
  EvaluationGrid,
  EvaluationGridFull,
  EvaluationGridCategory,
  EvaluationGridSubcriterion,
} from '@packages/database-service/domain/entities';

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

interface GridEditorProps {
  gridId: string;
  onBack: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (grid: EvaluationGridFull) => void;
  onTest: () => void;
}

type FullCategory = EvaluationGridCategory & { subcriteria: EvaluationGridSubcriterion[] };

export function GridEditor({ gridId, onBack, onDeleted, onUpdated, onTest }: GridEditorProps) {
  const [grid, setGrid] = useState<EvaluationGridFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);

  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);

  const [catDrawerOpen, setCatDrawerOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<EvaluationGridCategory | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<EvaluationGridSubcriterion | null>(null);
  const [activeCatForSub, setActiveCatForSub] = useState<FullCategory | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState('');

  const toast = useToast();
  const confirm = useConfirm();

  const fetchGrid = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluation-grids/${gridId}`);
      if (!res.ok) throw new Error('Not found');
      const data: EvaluationGridFull = await res.json();
      setGrid(data);
      onUpdated(data);
    } catch {
      toast('Failed to load grid', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId]);

  useEffect(() => {
    fetchGrid();
  }, [fetchGrid]);

  const toggleExpanded = (catId: string) =>
    setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }));

  /* ---------- Grid metadata ---------- */

  const handleMetaSaved = async (saved: EvaluationGrid) => {
    setMetaDrawerOpen(false);
    await fetchGrid();
    toast('Grid details updated', 'success');
  };

  const togglePublish = async () => {
    if (!grid) return;
    const nextStatus = grid.status === 'published' ? 'draft' : 'published';
    setPublishing(true);
    try {
      const res = await fetch(`/api/evaluation-grids/${grid.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        toast('Failed to update status', 'error');
        return;
      }
      await fetchGrid();
      toast(nextStatus === 'published' ? 'Grid published' : 'Grid moved back to draft', 'success');
    } catch {
      toast('Failed to update status', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const deleteGrid = async () => {
    if (!grid) return;
    const ok = await confirm({
      title: 'Delete evaluation grid',
      message: 'This will permanently delete the grid and all its categories and criteria. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/evaluation-grids/${grid.uuid}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Evaluation grid deleted', 'success');
      onDeleted(grid.uuid);
    } else {
      toast('Failed to delete grid', 'error');
    }
  };

  /** Portable JSON — no DB-internal fields (uuid, grid_id/category_id, status,
   * version, timestamps) and no `position` (implied by array order), so a
   * file exported here can be re-imported via GridDrawer's "Import" button. */
  const exportGrid = () => {
    if (!grid) return;
    const portable = {
      name: grid.name,
      slug: grid.slug,
      description: grid.description ?? undefined,
      instructions: grid.instructions ?? undefined,
      categories: grid.categories
        .sort((a, b) => a.position - b.position)
        .map((cat) => ({
          name: cat.name,
          weight: cat.weight,
          type: cat.type,
          subcriteria: cat.subcriteria
            .sort((a, b) => a.position - b.position)
            .map((sub) => ({
              criterion: sub.criterion,
              description: sub.description ?? undefined,
              weight: sub.weight ?? undefined,
              metrics: sub.metrics ?? undefined,
              indicators: sub.indicators ?? undefined,
              scoring_excellent: sub.scoring_excellent ?? undefined,
              scoring_good: sub.scoring_good ?? undefined,
              scoring_average: sub.scoring_average ?? undefined,
              scoring_poor: sub.scoring_poor ?? undefined,
            })),
        })),
    };
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${grid.slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- Category CRUD ---------- */

  const openNewCat = () => {
    setEditingCat(null);
    setCatError('');
    setCatDrawerOpen(true);
  };

  const openEditCat = (cat: EvaluationGridCategory) => {
    setEditingCat(cat);
    setCatError('');
    setCatDrawerOpen(true);
  };

  const handleSubmitCat = async (values: CategoryFormValues) => {
    if (!grid) return;
    setCatSaving(true);
    setCatError('');
    try {
      const payload = {
        name: values.name,
        weight: values.weightPercent / 100,
        type: values.type,
        position: editingCat ? editingCat.position : grid.categories.length,
      };
      const url = editingCat
        ? `/api/evaluation-grids/${grid.uuid}/categories/${editingCat.uuid}`
        : `/api/evaluation-grids/${grid.uuid}/categories`;
      const method = editingCat ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCatError(body?.error ?? 'Failed to save category');
        return;
      }
      setCatDrawerOpen(false);
      await fetchGrid();
      toast(editingCat ? 'Category updated' : 'Category created', 'success');
    } catch {
      setCatError('Network error');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (cat: EvaluationGridCategory) => {
    if (!grid) return;
    const ok = await confirm({
      title: 'Delete category',
      message: `This will delete "${cat.name}" and all its subcriteria. Are you sure?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/evaluation-grids/${grid.uuid}/categories/${cat.uuid}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchGrid();
      toast('Category deleted', 'success');
    } else {
      toast('Failed to delete category', 'error');
    }
  };

  /* ---------- Subcriterion CRUD ---------- */

  const openNewSub = (cat: FullCategory) => {
    setActiveCatForSub(cat);
    setEditingSub(null);
    setSubError('');
    setSubDrawerOpen(true);
    setExpanded((prev) => ({ ...prev, [cat.uuid]: true }));
  };

  const openEditSub = (cat: FullCategory, sub: EvaluationGridSubcriterion) => {
    setActiveCatForSub(cat);
    setEditingSub(sub);
    setSubError('');
    setSubDrawerOpen(true);
  };

  const handleSubmitSub = async (values: CriterionFormValues) => {
    if (!grid || !activeCatForSub) return;
    setSubSaving(true);
    setSubError('');
    try {
      const payload = {
        criterion: values.criterion.trim(),
        description: values.description.trim() || undefined,
        weight: values.weight ? Number(values.weight) : undefined,
        metrics: values.metrics ? values.metrics.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        indicators: values.indicators ? values.indicators.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        scoring_excellent: values.scoring_excellent.trim() || undefined,
        scoring_good: values.scoring_good.trim() || undefined,
        scoring_average: values.scoring_average.trim() || undefined,
        scoring_poor: values.scoring_poor.trim() || undefined,
        position: editingSub ? editingSub.position : activeCatForSub.subcriteria.length,
      };

      const url = editingSub
        ? `/api/evaluation-grids/${grid.uuid}/categories/${activeCatForSub.uuid}/subcriteria/${editingSub.uuid}`
        : `/api/evaluation-grids/${grid.uuid}/categories/${activeCatForSub.uuid}/subcriteria`;
      const method = editingSub ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSubError(body?.error ?? 'Failed to save criterion');
        return;
      }
      setSubDrawerOpen(false);
      await fetchGrid();
      toast(editingSub ? 'Criterion updated' : 'Criterion created', 'success');
    } catch {
      setSubError('Network error');
    } finally {
      setSubSaving(false);
    }
  };

  const deleteSub = async (cat: EvaluationGridCategory, sub: EvaluationGridSubcriterion) => {
    if (!grid) return;
    const ok = await confirm({
      title: 'Delete criterion',
      message: `Delete "${sub.criterion}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(
      `/api/evaluation-grids/${grid.uuid}/categories/${cat.uuid}/subcriteria/${sub.uuid}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      await fetchGrid();
      toast('Criterion deleted', 'success');
    } else {
      toast('Failed to delete criterion', 'error');
    }
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (!grid) {
    return <div className="text-sm text-red-400">Grid not found.</div>;
  }

  const totalWeight = grid.categories.reduce((sum, cat) => sum + cat.weight, 0);
  const weightPercent = Math.round(totalWeight * 100);
  const weightIsBalanced = Math.abs(totalWeight - 1) <= 0.01;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3 w-3" />
        Evaluation Grids
      </button>

      {/* Header */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">{grid.name}</h2>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/40">
                {grid.slug}
              </span>
              <Badge label={grid.status} />
            </div>
            {grid.description && <p className="mt-1.5 text-sm text-white/40">{grid.description}</p>}
            {grid.instructions && (
              <p className="mt-2 text-xs text-white/30">
                <span className="font-medium text-white/40">AI instructions: </span>
                {grid.instructions}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={onTest} title="Test this grid">
              <FlaskConical className="h-3.5 w-3.5" />
              Test
            </Button>
            <Button size="sm" variant="secondary" onClick={exportGrid} title="Export as JSON">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMetaDrawerOpen(true)} title="Edit details">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={grid.status === 'published' ? 'secondary' : 'primary'}
              onClick={togglePublish}
              disabled={publishing}
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {grid.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
            <Button size="sm" variant="danger" onClick={deleteGrid} title="Delete grid">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Weight balance indicator */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-white/40">Category weight allocated</span>
          <span className={weightIsBalanced ? 'text-green-400' : 'text-yellow-400'}>{weightPercent}% of 100%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${weightIsBalanced ? 'bg-green-500/60' : 'bg-yellow-500/60'}`}
            style={{ width: `${Math.min(weightPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          Categories <span className="text-white/15">({grid.categories.length})</span>
        </h3>
        <Button size="sm" onClick={openNewCat}>
          <Plus className="h-3.5 w-3.5" />
          Category
        </Button>
      </div>

      {grid.categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
          No categories yet. Add one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {grid.categories
            .sort((a, b) => a.position - b.position)
            .map((cat) => (
              <CategoryAccordion
                key={cat.uuid}
                category={cat}
                isExpanded={!!expanded[cat.uuid]}
                onToggle={() => toggleExpanded(cat.uuid)}
                onEdit={() => openEditCat(cat)}
                onDelete={() => deleteCat(cat)}
                onAddSub={() => openNewSub(cat)}
                onEditSub={(sub) => openEditSub(cat, sub)}
                onDeleteSub={(sub) => deleteSub(cat, sub)}
              />
            ))}
        </div>
      )}

      {/* Drawers */}
      <GridDrawer open={metaDrawerOpen} onClose={() => setMetaDrawerOpen(false)} onSaved={handleMetaSaved} grid={grid} />

      <CategoryDrawer
        open={catDrawerOpen}
        onClose={() => setCatDrawerOpen(false)}
        category={editingCat}
        saving={catSaving}
        error={catError}
        onSubmit={handleSubmitCat}
      />

      <CriterionDrawer
        open={subDrawerOpen}
        onClose={() => setSubDrawerOpen(false)}
        criterion={editingSub}
        categoryName={activeCatForSub?.name}
        saving={subSaving}
        error={subError}
        onSubmit={handleSubmitSub}
      />
    </div>
  );
}

/* ================================================================== */
/*  Category accordion                                                 */
/* ================================================================== */

function CategoryAccordion({
  category,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
}: {
  category: FullCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: () => void;
  onEditSub: (sub: EvaluationGridSubcriterion) => void;
  onDeleteSub: (sub: EvaluationGridSubcriterion) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      {/* A <div role="button"> here, not a real <button> — it wraps the
          Add/Edit/Delete <Button>s below, and <button> cannot contain
          nested <button> elements (invalid HTML, breaks hydration). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={isExpanded}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brandCP/40"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/30" />
          )}
          <span className="truncate font-medium text-white">{category.name}</span>
          <Badge label={category.type} />
          <span className="shrink-0 text-xs text-white/30">{Math.round(category.weight * 100)}%</span>
          <span className="shrink-0 text-xs text-white/20">
            {category.subcriteria.length} criteri{category.subcriteria.length === 1 ? 'on' : 'a'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={onAddSub} title="Add criterion">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Edit category">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} title="Delete category">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 border-t border-white/[0.06] p-3">
          {category.subcriteria.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/30">No criteria yet in this category.</p>
          ) : (
            category.subcriteria
              .sort((a, b) => a.position - b.position)
              .map((sub) => (
                <SubcriterionCard key={sub.uuid} sub={sub} onEdit={() => onEditSub(sub)} onDelete={() => onDeleteSub(sub)} />
              ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Subcriterion display card                                          */
/* ================================================================== */

function SubcriterionCard({
  sub,
  onEdit,
  onDelete,
}: {
  sub: EvaluationGridSubcriterion;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasScoring = sub.scoring_excellent || sub.scoring_good || sub.scoring_average || sub.scoring_poor;

  return (
    <div className="rounded-lg bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white/90">{sub.criterion}</span>
            {sub.weight != null && <span className="text-xs text-white/30">w:{sub.weight}</span>}
          </div>
          {sub.description && <p className="mt-0.5 text-xs text-white/40">{sub.description}</p>}
          {((sub.metrics?.length ?? 0) > 0 || (sub.indicators?.length ?? 0) > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(sub.metrics ?? []).map((m, i) => (
                <span key={`m-${i}`} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                  {m}
                </span>
              ))}
              {(sub.indicators ?? []).map((ind, i) => (
                <span key={`i-${i}`} className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">
                  {ind}
                </span>
              ))}
            </div>
          )}
          {hasScoring && (
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-white/40 sm:grid-cols-4">
              {sub.scoring_excellent && <span>🟢 {sub.scoring_excellent}</span>}
              {sub.scoring_good && <span>🔵 {sub.scoring_good}</span>}
              {sub.scoring_average && <span>🟡 {sub.scoring_average}</span>}
              {sub.scoring_poor && <span>🔴 {sub.scoring_poor}</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
