'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface Subcriterion {
  uuid?: string;
  criterion: string;
  description?: string;
  weight?: number;
  metrics?: string[];
  indicators?: string[];
  scoring_excellent?: string;
  scoring_good?: string;
  scoring_average?: string;
  scoring_poor?: string;
  position: number;
}

interface Category {
  uuid?: string;
  name: string;
  weight: number;
  type: 'objective' | 'mixed' | 'subjective' | 'contextual';
  position: number;
  subcriteria: Subcriterion[];
}

interface EvaluationGridFull {
  uuid: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  status: string;
  instructions?: string;
  categories: Category[];
}

interface EvaluationGridEditorProps {
  gridId: string;
  onClose: () => void;
}

export function EvaluationGridEditor({ gridId, onClose }: EvaluationGridEditorProps) {
  const [grid, setGrid] = useState<EvaluationGridFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [expandedSubcriterion, setExpandedSubcriterion] = useState<string | null>(null);

  useEffect(() => {
    fetchGrid();
  }, [gridId]);

  const fetchGrid = async () => {
    try {
      const res = await fetch(`/api/admin/evaluation-grids/${gridId}`);
      const data = await res.json();
      setGrid(data);
    } catch (error) {
      console.error('Error fetching grid:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!grid) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/evaluation-grids/${gridId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: grid.name,
          description: grid.description,
          instructions: grid.instructions,
          categories: grid.categories,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGrid(data.grid);
        alert('Grid saved successfully!');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving grid:', error);
      alert('Error saving grid');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (!grid) return;
    const newCategory: Category = {
      name: 'New Category',
      weight: 0.1,
      type: 'mixed',
      position: grid.categories.length,
      subcriteria: [],
    };
    setGrid({ ...grid, categories: [...grid.categories, newCategory] });
    setExpandedCategory(grid.categories.length);
  };

  const updateCategory = (index: number, updates: Partial<Category>) => {
    if (!grid) return;
    const categories = [...grid.categories];
    categories[index] = { ...categories[index], ...updates };
    setGrid({ ...grid, categories });
  };

  const deleteCategory = (index: number) => {
    if (!grid) return;
    if (!confirm('Delete this category and all its subcriteria?')) return;
    const categories = grid.categories.filter((_, i) => i !== index);
    setGrid({ ...grid, categories });
    setExpandedCategory(null);
  };

  const addSubcriterion = (categoryIndex: number) => {
    if (!grid) return;
    const categories = [...grid.categories];
    const newSub: Subcriterion = {
      criterion: 'New Criterion',
      description: '',
      position: categories[categoryIndex].subcriteria.length,
    };
    categories[categoryIndex].subcriteria.push(newSub);
    setGrid({ ...grid, categories });
  };

  const updateSubcriterion = (categoryIndex: number, subIndex: number, updates: Partial<Subcriterion>) => {
    if (!grid) return;
    const categories = [...grid.categories];
    categories[categoryIndex].subcriteria[subIndex] = {
      ...categories[categoryIndex].subcriteria[subIndex],
      ...updates,
    };
    setGrid({ ...grid, categories });
  };

  const deleteSubcriterion = (categoryIndex: number, subIndex: number) => {
    if (!grid) return;
    const categories = [...grid.categories];
    categories[categoryIndex].subcriteria = categories[categoryIndex].subcriteria.filter((_, i) => i !== subIndex);
    setGrid({ ...grid, categories });
  };

  const totalWeight = grid?.categories.reduce((sum, cat) => sum + cat.weight, 0) || 0;

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
  }

  if (!grid) {
    return <div className="text-red-400">Grid not found</div>;
  }

  const isReadOnly = grid.status === 'published';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{grid.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-white/50">{grid.slug}</span>
            <StatusBadge status={grid.status} />
            <span className="text-sm text-white/50">v{grid.version}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {isReadOnly && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-400">
          This grid is published and cannot be edited. Duplicate it to make changes.
        </div>
      )}

      {/* Grid Metadata */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-white/70">Name</label>
            <input
              type="text"
              value={grid.name}
              onChange={(e) => setGrid({ ...grid, name: e.target.value })}
              disabled={isReadOnly}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Description</label>
            <input
              type="text"
              value={grid.description || ''}
              onChange={(e) => setGrid({ ...grid, description: e.target.value })}
              disabled={isReadOnly}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/70">Instructions (for AI evaluator)</label>
          <textarea
            value={grid.instructions || ''}
            onChange={(e) => setGrid({ ...grid, instructions: e.target.value })}
            disabled={isReadOnly}
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* Weight Summary */}
      <div className={`rounded-lg p-3 text-sm ${Math.abs(totalWeight - 1) < 0.01 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
        Total weight: {totalWeight.toFixed(2)} {Math.abs(totalWeight - 1) < 0.01 ? '✓' : '(must equal 1.00)'}
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Categories ({grid.categories.length})</h3>
          {!isReadOnly && (
            <Button size="sm" variant="secondary" onClick={addCategory}>
              + Add Category
            </Button>
          )}
        </div>

        {grid.categories.map((category, catIndex) => (
          <div key={catIndex} className="rounded-lg border border-white/10 bg-white/5">
            {/* Category Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
              onClick={() => setExpandedCategory(expandedCategory === catIndex ? null : catIndex)}
            >
              <div className="flex items-center gap-3">
                <span className="text-white/50">{expandedCategory === catIndex ? '▼' : '▶'}</span>
                <div>
                  <div className="font-medium text-white">{category.name}</div>
                  <div className="text-xs text-white/50">
                    {category.type} • weight: {category.weight} • {category.subcriteria.length} criteria
                  </div>
                </div>
              </div>
              {!isReadOnly && (
                <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); deleteCategory(catIndex); }}>
                  🗑️
                </Button>
              )}
            </div>

            {/* Category Details */}
            {expandedCategory === catIndex && (
              <div className="border-t border-white/10 p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-white/70">Name</label>
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => updateCategory(catIndex, { name: e.target.value })}
                      disabled={isReadOnly}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/70">Weight</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={category.weight}
                      onChange={(e) => updateCategory(catIndex, { weight: parseFloat(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/70">Type</label>
                    <select
                      value={category.type}
                      onChange={(e) => updateCategory(catIndex, { type: e.target.value as Category['type'] })}
                      disabled={isReadOnly}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                    >
                      <option value="objective">Objective</option>
                      <option value="mixed">Mixed</option>
                      <option value="subjective">Subjective</option>
                      <option value="contextual">Contextual</option>
                    </select>
                  </div>
                </div>

                {/* Subcriteria */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-white/80">Subcriteria</h4>
                    {!isReadOnly && (
                      <Button size="sm" variant="ghost" onClick={() => addSubcriterion(catIndex)}>
                        + Add
                      </Button>
                    )}
                  </div>

                  {category.subcriteria.map((sub, subIndex) => {
                    const subKey = `${catIndex}-${subIndex}`;
                    const isExpanded = expandedSubcriterion === subKey;

                    return (
                      <div key={subIndex} className="rounded border border-white/10 bg-white/5">
                        <div
                          className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/5"
                          onClick={() => setExpandedSubcriterion(isExpanded ? null : subKey)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/50">{isExpanded ? '▼' : '▶'}</span>
                            <span className="text-sm text-white">{sub.criterion}</span>
                          </div>
                          {!isReadOnly && (
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteSubcriterion(catIndex, subIndex); }}>
                              ✕
                            </Button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/10 p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-xs text-white/70">Criterion</label>
                                <input
                                  type="text"
                                  value={sub.criterion}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { criterion: e.target.value })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-white/70">Weight (optional)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={sub.weight || ''}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { weight: parseFloat(e.target.value) || undefined })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-white/70">Description</label>
                              <textarea
                                value={sub.description || ''}
                                onChange={(e) => updateSubcriterion(catIndex, subIndex, { description: e.target.value })}
                                disabled={isReadOnly}
                                rows={2}
                                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-white/70">Metrics (comma-separated)</label>
                              <input
                                type="text"
                                value={(sub.metrics || []).join(', ')}
                                onChange={(e) => updateSubcriterion(catIndex, subIndex, { metrics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                disabled={isReadOnly}
                                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-white/70">Indicators (comma-separated)</label>
                              <input
                                type="text"
                                value={(sub.indicators || []).join(', ')}
                                onChange={(e) => updateSubcriterion(catIndex, subIndex, { indicators: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                disabled={isReadOnly}
                                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-xs text-green-400">Excellent (8-9)</label>
                                <input
                                  type="text"
                                  value={sub.scoring_excellent || ''}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { scoring_excellent: e.target.value })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-blue-400">Good (5-7)</label>
                                <input
                                  type="text"
                                  value={sub.scoring_good || ''}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { scoring_good: e.target.value })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-yellow-400">Average (2-4)</label>
                                <input
                                  type="text"
                                  value={sub.scoring_average || ''}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { scoring_average: e.target.value })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-red-400">Poor (0-1)</label>
                                <input
                                  type="text"
                                  value={sub.scoring_poor || ''}
                                  onChange={(e) => updateSubcriterion(catIndex, subIndex, { scoring_poor: e.target.value })}
                                  disabled={isReadOnly}
                                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brandCP focus:outline-none disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
