'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';
import { GridCard } from './GridCard';
import { GridEditor } from './GridEditor';
import { GridDrawer } from './GridDrawer';
import { GridTestRun } from './GridTestRun';
import type { EvaluationGrid, EvaluationGridFull } from '@packages/database-service/domain/entities';

type View = { mode: 'list' } | { mode: 'edit'; gridId: string } | { mode: 'test'; gridId: string };

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50';

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
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <ClipboardList className="h-3.5 w-3.5" />
          Evaluation Grids
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grids…"
              className={`${inputClass} w-48 pl-8`}
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New grid
          </Button>
        </div>
      </div>

      {loading ? (
        <GridListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] py-12 text-center text-sm text-white/40">
          {grids.length === 0
            ? 'No evaluation grids yet. Create the first one.'
            : 'No grid matches your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

function GridListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}
