'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Pencil, Trash2, ChevronLeft, Plus } from 'lucide-react';
import type {
  EvaluationGridFull,
  EvaluationGridCategory,
  EvaluationGridSubcriterion,
  EvaluationGridCategoryType,
} from '../../../../../../../packages/database-service/domain/entities';

/* ------------------------------------------------------------------ */
/*  Types locaux pour les formulaires                                  */
/* ------------------------------------------------------------------ */

interface CategoryFormData {
  name: string;
  weight: number;
  type: EvaluationGridCategoryType;
  position: number;
}

interface SubcriterionFormData {
  criterion: string;
  description: string;
  weight: string;
  metrics: string;
  indicators: string;
  scoring_excellent: string;
  scoring_good: string;
  scoring_average: string;
  scoring_poor: string;
  position: number;
}

const EMPTY_CATEGORY: CategoryFormData = { name: '', weight: 0.25, type: 'objective', position: 0 };
const EMPTY_SUB: SubcriterionFormData = {
  criterion: '', description: '', weight: '', metrics: '', indicators: '',
  scoring_excellent: '', scoring_good: '', scoring_average: '', scoring_poor: '', position: 0,
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50';


/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */

export default function EvaluationGridDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [grid, setGrid] = useState<EvaluationGridFull | null>(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  // Category form state
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<EvaluationGridCategory | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormData>(EMPTY_CATEGORY);

  // Subcriterion form state
  const [showSubForm, setShowSubForm] = useState<string | null>(null); // categoryId
  const [editingSub, setEditingSub] = useState<EvaluationGridSubcriterion | null>(null);
  const [subForm, setSubForm] = useState<SubcriterionFormData>(EMPTY_SUB);

  /* ---------- fetch ---------- */

  const fetchGrid = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluation-grids/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setGrid(data);
    } catch (error) {
      console.error('Error fetching grid:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  /* ---------- Category CRUD ---------- */

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ ...EMPTY_CATEGORY, position: grid?.categories.length ?? 0 });
    setShowCatForm(true);
  };

  const openEditCat = (cat: EvaluationGridCategory) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, weight: cat.weight, type: cat.type, position: cat.position });
    setShowCatForm(true);
  };

  const cancelCat = () => { setShowCatForm(false); setEditingCat(null); setCatForm(EMPTY_CATEGORY); };

  const saveCat = async () => {
    const url = editingCat
      ? `/api/evaluation-grids/${id}/categories/${editingCat.uuid}`
      : `/api/evaluation-grids/${id}/categories`;
    const method = editingCat ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm),
    });
    if (res.ok) {
      cancelCat();
      await fetchGrid();
      toast(editingCat ? 'Category updated' : 'Category created', 'success');
    } else {
      toast('Failed to save category', 'error');
    }
  };

  const deleteCat = async (catId: string) => {
    const ok = await confirm({
      title: 'Delete Category',
      message: 'This will delete the category and all its subcriteria. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/evaluation-grids/${id}/categories/${catId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchGrid();
      toast('Category deleted', 'success');
    } else {
      toast('Failed to delete category', 'error');
    }
  };

  /* ---------- Subcriterion CRUD ---------- */

  const openNewSub = (catId: string) => {
    setEditingSub(null);
    const cat = grid?.categories.find(c => c.uuid === catId);
    setSubForm({ ...EMPTY_SUB, position: cat?.subcriteria.length ?? 0 });
    setShowSubForm(catId);
  };

  const openEditSub = (catId: string, sub: EvaluationGridSubcriterion) => {
    setEditingSub(sub);
    setSubForm({
      criterion: sub.criterion,
      description: sub.description ?? '',
      weight: sub.weight != null ? String(sub.weight) : '',
      metrics: (sub.metrics ?? []).join(', '),
      indicators: (sub.indicators ?? []).join(', '),
      scoring_excellent: sub.scoring_excellent ?? '',
      scoring_good: sub.scoring_good ?? '',
      scoring_average: sub.scoring_average ?? '',
      scoring_poor: sub.scoring_poor ?? '',
      position: sub.position,
    });
    setShowSubForm(catId);
  };

  const cancelSub = () => { setShowSubForm(null); setEditingSub(null); setSubForm(EMPTY_SUB); };

  const saveSub = async (catId: string) => {
    const payload: any = {
      criterion: subForm.criterion,
      description: subForm.description || undefined,
      weight: subForm.weight ? Number(subForm.weight) : undefined,
      metrics: subForm.metrics ? subForm.metrics.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      indicators: subForm.indicators ? subForm.indicators.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      scoring_excellent: subForm.scoring_excellent || undefined,
      scoring_good: subForm.scoring_good || undefined,
      scoring_average: subForm.scoring_average || undefined,
      scoring_poor: subForm.scoring_poor || undefined,
      position: subForm.position,
    };

    const url = editingSub
      ? `/api/evaluation-grids/${id}/categories/${catId}/subcriteria/${editingSub.uuid}`
      : `/api/evaluation-grids/${id}/categories/${catId}/subcriteria`;
    const method = editingSub ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      cancelSub();
      await fetchGrid();
      toast(editingSub ? 'Subcriterion updated' : 'Subcriterion created', 'success');
    } else {
      toast('Failed to save subcriterion', 'error');
    }
  };

  const deleteSub = async (catId: string, subId: string) => {
    const ok = await confirm({
      title: 'Delete Subcriterion',
      message: 'Are you sure you want to delete this subcriterion?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/evaluation-grids/${id}/categories/${catId}/subcriteria/${subId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchGrid();
      toast('Subcriterion deleted', 'success');
    } else {
      toast('Failed to delete subcriterion', 'error');
    }
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded bg-white/5" />
        <div className="h-12 rounded-md bg-white/5" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-md bg-white/5" />)}
      </div>
    );
  }
  if (!grid) return <div className="text-red-400">Grid not found</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <button
          onClick={() => router.push('/admin/evaluation-grids')}
          className="mb-2 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Evaluation Grids
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{grid.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/40 font-mono">{grid.slug}</span>
              <span className="text-xs text-white/30">v{grid.version}</span>
              <Badge label={grid.status} />
            </div>
            {grid.description && <p className="mt-2 text-sm text-white/40">{grid.description}</p>}
          </div>
        </div>
      </div>

      {/* Categories */}
      <Card
        title="Categories"
        count={grid.categories.length}
        action={
          <Button size="sm" onClick={openNewCat}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Category
          </Button>
        }
      >
        {/* Category form */}
        {showCatForm && (
          <div className="border-b border-white/10 p-4">
            <h4 className="mb-3 text-sm font-semibold text-white">
              {editingCat ? 'Edit Category' : 'New Category'}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-white/50">Name *</label>
                <input className={inputClass} value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Weight (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" className={inputClass} value={catForm.weight} onChange={e => setCatForm(p => ({ ...p, weight: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Type</label>
                <select className={inputClass} value={catForm.type} onChange={e => setCatForm(p => ({ ...p, type: e.target.value as EvaluationGridCategoryType }))}>
                  <option value="objective">Objective</option>
                  <option value="mixed">Mixed</option>
                  <option value="subjective">Subjective</option>
                  <option value="contextual">Contextual</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Position</label>
                <input type="number" min="0" className={inputClass} value={catForm.position} onChange={e => setCatForm(p => ({ ...p, position: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={saveCat}>Save</Button>
              <Button size="sm" variant="secondary" onClick={cancelCat}>Cancel</Button>
            </div>
          </div>
        )}

        {grid.categories.length === 0 && !showCatForm ? (
          <p className="py-8 text-center text-sm text-white/40">No categories yet. Add one to get started.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {grid.categories
              .sort((a, b) => a.position - b.position)
              .map((cat) => (
                <div key={cat.uuid} className="p-4">
                  {/* Category header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{cat.name}</span>
                      <Badge label={cat.type} />
                      <span className="text-xs text-white/40">weight: {cat.weight}</span>
                      <span className="text-xs text-white/30">pos: {cat.position}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openNewSub(cat.uuid)} title="Add subcriterion">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditCat(cat)} title="Edit category">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteCat(cat.uuid)} title="Delete category">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Subcriterion form (inline under this category) */}
                  {showSubForm === cat.uuid && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <h5 className="mb-2 text-xs font-semibold text-white">
                        {editingSub ? 'Edit Subcriterion' : 'New Subcriterion'}
                      </h5>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="mb-0.5 block text-xs text-white/50">Criterion *</label>
                          <input className={inputClass} value={subForm.criterion} onChange={e => setSubForm(p => ({ ...p, criterion: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Weight</label>
                          <input type="number" step="0.01" min="0" max="1" className={inputClass} value={subForm.weight} onChange={e => setSubForm(p => ({ ...p, weight: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Position</label>
                          <input type="number" min="0" className={inputClass} value={subForm.position} onChange={e => setSubForm(p => ({ ...p, position: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="mb-0.5 block text-xs text-white/50">Description</label>
                        <textarea className={inputClass} rows={2} value={subForm.description} onChange={e => setSubForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Metrics (comma-separated)</label>
                          <input className={inputClass} value={subForm.metrics} onChange={e => setSubForm(p => ({ ...p, metrics: e.target.value }))} placeholder="LOC, complexity, coverage" />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Indicators (comma-separated)</label>
                          <input className={inputClass} value={subForm.indicators} onChange={e => setSubForm(p => ({ ...p, indicators: e.target.value }))} placeholder="readability, maintainability" />
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Scoring: Excellent</label>
                          <input className={inputClass} value={subForm.scoring_excellent} onChange={e => setSubForm(p => ({ ...p, scoring_excellent: e.target.value }))} placeholder="8-9" />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Scoring: Good</label>
                          <input className={inputClass} value={subForm.scoring_good} onChange={e => setSubForm(p => ({ ...p, scoring_good: e.target.value }))} placeholder="5-7" />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Scoring: Average</label>
                          <input className={inputClass} value={subForm.scoring_average} onChange={e => setSubForm(p => ({ ...p, scoring_average: e.target.value }))} placeholder="2-4" />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-white/50">Scoring: Poor</label>
                          <input className={inputClass} value={subForm.scoring_poor} onChange={e => setSubForm(p => ({ ...p, scoring_poor: e.target.value }))} placeholder="0-1" />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => saveSub(cat.uuid)}>Save</Button>
                        <Button size="sm" variant="secondary" onClick={cancelSub}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Subcriteria list */}
                  {cat.subcriteria.length > 0 && (
                    <div className="mt-3 space-y-1 pl-4">
                      {cat.subcriteria
                        .sort((a, b) => a.position - b.position)
                        .map((sub) => (
                          <div key={sub.uuid} className="flex items-start justify-between rounded-md bg-white/[0.02] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white/90">{sub.criterion}</span>
                                {sub.weight != null && (
                                  <span className="text-xs text-white/30">w:{sub.weight}</span>
                                )}
                                <span className="text-xs text-white/20">#{sub.position}</span>
                              </div>
                              {sub.description && (
                                <p className="mt-0.5 text-xs text-white/40">{sub.description}</p>
                              )}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(sub.metrics ?? []).map((m, i) => (
                                  <span key={i} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">{m}</span>
                                ))}
                                {(sub.indicators ?? []).map((ind, i) => (
                                  <span key={i} className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">{ind}</span>
                                ))}
                              </div>
                              {(sub.scoring_excellent || sub.scoring_good || sub.scoring_average || sub.scoring_poor) && (
                                <div className="mt-1 flex gap-2 text-[10px] text-white/30">
                                  {sub.scoring_excellent && <span>🟢 {sub.scoring_excellent}</span>}
                                  {sub.scoring_good && <span>🔵 {sub.scoring_good}</span>}
                                  {sub.scoring_average && <span>🟡 {sub.scoring_average}</span>}
                                  {sub.scoring_poor && <span>🔴 {sub.scoring_poor}</span>}
                                </div>
                              )}
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditSub(cat.uuid, sub)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => deleteSub(cat.uuid, sub.uuid)} title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
