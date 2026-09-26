'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';
import { GridCard } from './GridCard';
import { GridEditor } from './GridEditor';
import { GridDrawer } from './GridDrawer';
import { GridTestRun } from './GridTestRun';
import type { EvaluationGrid, EvaluationGridFull } from '@packages/database-service/domain/entities';

type View = { mode: 'list' } | { mode: 'edit'; gridId: string } | { mode: 'test'; gridId: string };

// The contributor profile tree doesn't mount ToastProvider/ConfirmDialogProvider
// (only apps/leaderboard-client/src/app/admin/layout.tsx does), so this tab
// brings its own — nesting is harmless where they already exist (e.g. /admin/**).
export function EvaluationGridsTab() {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <EvaluationGridsPanel />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}

function EvaluationGridsPanel() {
  const [grids, setGrids] = useState<EvaluationGrid[]>([]);
  const [details, setDetails] = useState<Record<string, EvaluationGridFull>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>({ mode: 'list' });
  const [createOpen, setCreateOpen] = useState(false);

  const toast = useToast();

  const loadDetail = async (gridId: string) => {
    try {
      const res = await fetch(`/api/evaluation-grids/${gridId}`);
      if (!res.ok) return;
      const full: EvaluationGridFull = await res.json();
      setDetails((prev) => ({ ...prev, [gridId]: full }));
    } catch {
      // counts stay unknown for this card — non-critical
    }
  };

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/evaluation-grids');
      if (!res.ok) throw new Error('Failed to load');
      const data: EvaluationGrid[] = await res.json();
      setGrids(data);
      data.forEach((g) => loadDetail(g.uuid));
    } catch {
      toast('Failed to load evaluation grids', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grids;
    return grids.filter(
      (g) => g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q)
    );
  }, [grids, search]);

  const handleCreated = (grid: EvaluationGrid) => {
    setGrids((prev) => [grid, ...prev]);
    toast('Evaluation grid created', 'success');
    setView({ mode: 'edit', gridId: grid.uuid });
  };

  const handleDeleted = (id: string) => {
    setGrids((prev) => prev.filter((g) => g.uuid !== id));
    setDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setView({ mode: 'list' });
  };

  const handleGridUpdated = (grid: EvaluationGridFull) => {
    setGrids((prev) => prev.map((g) => (g.uuid === grid.uuid ? grid : g)));
    setDetails((prev) => ({ ...prev, [grid.uuid]: grid }));
  };

  if (view.mode === 'test') {
    return (
      <div className="animate-fade-up">
        <GridTestRun gridId={view.gridId} onBack={() => setView({ mode: 'edit', gridId: view.gridId })} />
      </div>
    );
  }

  if (view.mode === 'edit') {
    return (
      <div className="animate-fade-up">
        <GridEditor
          gridId={view.gridId}
          onBack={() => setView({ mode: 'list' })}
          onDeleted={handleDeleted}
          onUpdated={handleGridUpdated}
          onTest={() => setView({ mode: 'test', gridId: view.gridId })}
        />
      </div>
    );
  }

  return (
    <>
      <div className="v-pro-head">
        <span className="v-pro-kicker">Evaluation grids</span>
        <div className="v-pro-digest-actions">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search grids…"
            className="v-pro-input"
            style={{ width: "12rem" }}
          />
          <button className="v-pro-btn" onClick={() => setCreateOpen(true)}>
            <Plus />
            New grid
          </button>
        </div>
      </div>

      {loading ? (
        <GridListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="v-pro-empty">
          <span className="v-pro-empty-sub">
            {grids.length === 0
              ? 'No evaluation grids yet. Create the first one.'
              : 'No grid matches your search.'}
          </span>
        </div>
      ) : (
        <div className="v-pro-cards">
          {filtered.map((grid) => (
            <GridCard
              key={grid.uuid}
              grid={grid}
              detail={details[grid.uuid]}
              onOpen={() => setView({ mode: 'edit', gridId: grid.uuid })}
            />
          ))}
        </div>
      )}

      <GridDrawer open={createOpen} onClose={() => setCreateOpen(false)} onSaved={handleCreated} />
    </>
  );
}

function GridListSkeleton() {
  return (
    <div className="v-pro-cards">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="v-pro-skeleton" />
      ))}
    </div>
  );
}
