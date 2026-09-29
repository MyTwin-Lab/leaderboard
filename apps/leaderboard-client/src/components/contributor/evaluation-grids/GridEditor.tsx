'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Download, FlaskConical, Loader2, Pencil, Plus, Trash2, Settings2 } from 'lucide-react';
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

import '@/components/vitrine/forms-vitrine.css';
import './evaluation-grids-vitrine.css';

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

/** La teinte de l'étiquette d'un type de catégorie. */
const CATEGORY_TONE: Record<string, string> = {
  objective: 'info',
  mixed: 'accent',
  subjective: 'warning',
  contextual: 'success',
};

/**
 * L'éditeur d'une grille — l'onglet grilles du profil, sous la racine vitrine
 * de la page. Sur le vocabulaire commun des formulaires (`v-*`), avec ce qui
 * est propre aux grilles dans `evaluation-grids-vitrine.css`.
 */
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
        <div className="v-eg-skeleton h-6 w-40" />
        <div className="v-eg-skeleton h-24" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="v-eg-skeleton h-16" />
        ))}
      </div>
    );
  }

  if (!grid) {
    return <p className="v-alert">Grid not found.</p>;
  }

  const totalWeight = grid.categories.reduce((sum, cat) => sum + cat.weight, 0);
  const weightPercent = Math.round(totalWeight * 100);
  const weightIsBalanced = Math.abs(totalWeight - 1) <= 0.01;
  const isPublished = grid.status === 'published';

  return (
    <div className="space-y-5">
      {/* Back */}
      <button type="button" onClick={onBack} className="v-back">
        <ArrowLeft />
        Evaluation Grids
      </button>

      {/* Header */}
      <div className="v-section">
        <div className="v-eg-head">
          <div className="v-eg-head-text">
            <div className="v-eg-head-title">
              <h2 className="v-eg-name">{grid.name}</h2>
              <span className="v-code">{grid.slug}</span>
              <span className="v-badge" data-tone={isPublished ? 'success' : 'warning'}>{grid.status}</span>
            </div>
            {grid.description && <p className="v-help">{grid.description}</p>}
            {grid.instructions && (
              <p className="v-help" data-size="xs">
                <strong>AI instructions: </strong>
                {grid.instructions}
              </p>
            )}
          </div>
          <div className="v-eg-actions">
            <button type="button" className="v-btn-quiet v-btn-sm" onClick={onTest} title="Test this grid">
              <FlaskConical />
              Test
            </button>
            <button type="button" className="v-btn-icon" onClick={exportGrid} title="Export as JSON" aria-label="Export as JSON">
              <Download />
            </button>
            <button type="button" className="v-btn-icon" onClick={() => setMetaDrawerOpen(true)} title="Edit details" aria-label="Edit details">
              <Settings2 />
            </button>
            <button
              type="button"
              className={isPublished ? 'v-btn-quiet v-btn-sm' : 'v-btn v-btn-sm'}
              onClick={togglePublish}
              disabled={publishing}
            >
              {publishing ? <Loader2 className="v-spin" /> : null}
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button type="button" className="v-btn-icon" data-tone="danger" onClick={deleteGrid} title="Delete grid" aria-label="Delete grid">
              <Trash2 />
            </button>
          </div>
        </div>
      </div>

      {/* Weight balance indicator */}
      <div className="v-section">
        <div className="v-eg-weight" data-ok={weightIsBalanced ? 'true' : 'false'}>
          <div className="v-eg-weight-head">
            <span>Category weight allocated</span>
            <span className="v-eg-weight-value" data-ok={weightIsBalanced ? 'true' : 'false'}>{weightPercent}% of 100%</span>
          </div>
          <div className="v-bar">
            <div className="v-bar-fill" style={{ width: `${Math.min(weightPercent, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="v-section-head">
        <h3 className="v-section-title">
          Categories ({grid.categories.length})
        </h3>
        <button type="button" className="v-btn v-btn-sm" onClick={openNewCat}>
          <Plus />
          Category
        </button>
      </div>

      {grid.categories.length === 0 ? (
        <div className="v-empty">
          <span className="v-empty-sub">No categories yet. Add one to get started.</span>
        </div>
      ) : (
        <div className="v-rows">
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
    <div className="v-eg-cat">
      {/* A <div role="button"> here, not a real <button> — it wraps the
          Add/Edit/Delete buttons below, and <button> cannot contain
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
        className="v-eg-cat-head"
      >
        <div className="v-eg-cat-main">
          {isExpanded ? <ChevronDown /> : <ChevronRight />}
          <span className="v-eg-cat-name">{category.name}</span>
          <span className="v-badge" data-tone={CATEGORY_TONE[category.type] ?? undefined}>{category.type}</span>
          <span className="v-eg-cat-meta">{Math.round(category.weight * 100)}%</span>
          <span className="v-eg-cat-meta">
            {category.subcriteria.length} criteri{category.subcriteria.length === 1 ? 'on' : 'a'}
          </span>
        </div>
        <div className="v-row-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="v-btn-icon" onClick={onAddSub} title="Add criterion" aria-label="Add criterion">
            <Plus />
          </button>
          <button type="button" className="v-btn-icon" onClick={onEdit} title="Edit category" aria-label="Edit category">
            <Pencil />
          </button>
          <button type="button" className="v-btn-icon" data-tone="danger" onClick={onDelete} title="Delete category" aria-label="Delete category">
            <Trash2 />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="v-eg-cat-body">
          {category.subcriteria.length === 0 ? (
            <p className="v-quiet">No criteria yet in this category.</p>
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
    <div className="v-eg-sub">
      <div className="v-eg-sub-text">
        <div className="v-eg-sub-title">
          <span>{sub.criterion}</span>
          {sub.weight != null && <span className="v-eg-sub-weight">w:{sub.weight}</span>}
        </div>
        {sub.description && <p className="v-help" data-size="xs">{sub.description}</p>}
        {((sub.metrics?.length ?? 0) > 0 || (sub.indicators?.length ?? 0) > 0) && (
          <div className="v-eg-tags">
            {(sub.metrics ?? []).map((m, i) => (
              <span key={`m-${i}`} className="v-eg-tag" data-kind="metric">
                {m}
              </span>
            ))}
            {(sub.indicators ?? []).map((ind, i) => (
              <span key={`i-${i}`} className="v-eg-tag" data-kind="indicator">
                {ind}
              </span>
            ))}
          </div>
        )}
        {hasScoring && (
          <div className="v-eg-sub-scoring">
            {sub.scoring_excellent && <span>🟢 {sub.scoring_excellent}</span>}
            {sub.scoring_good && <span>🔵 {sub.scoring_good}</span>}
            {sub.scoring_average && <span>🟡 {sub.scoring_average}</span>}
            {sub.scoring_poor && <span>🔴 {sub.scoring_poor}</span>}
          </div>
        )}
      </div>
      <div className="v-row-actions">
        <button type="button" className="v-btn-icon" onClick={onEdit} title="Edit" aria-label="Edit">
          <Pencil />
        </button>
        <button type="button" className="v-btn-icon" data-tone="danger" onClick={onDelete} title="Delete" aria-label="Delete">
          <Trash2 />
        </button>
      </div>
    </div>
  );
}
