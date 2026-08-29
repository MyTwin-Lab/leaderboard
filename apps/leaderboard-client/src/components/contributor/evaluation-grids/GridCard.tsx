'use client';

import { ChevronRight, LayoutGrid, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { EvaluationGrid, EvaluationGridFull } from '@packages/database-service/domain/entities';

interface GridCardProps {
  grid: EvaluationGrid;
  detail?: EvaluationGridFull;
  onOpen: () => void;
}

export function GridCard({ grid, detail, onOpen }: GridCardProps) {
  const categoriesCount = detail?.categories.length;
  const criteriaCount = detail?.categories.reduce((sum, c) => sum + c.subcriteria.length, 0);

  return (
    <button
      onClick={onOpen}
      className="group flex flex-col items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{grid.name}</p>
          <span className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/40">
            {grid.slug}
          </span>
        </div>
        <Badge label={grid.status} />
      </div>

      {grid.description && (
        <p className="line-clamp-2 text-xs text-white/40">{grid.description}</p>
      )}

      <div className="mt-auto flex w-full items-center justify-between pt-1 text-[11px] text-white/30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Categories">
            <LayoutGrid className="h-3 w-3" />
            {categoriesCount ?? '…'}
          </span>
          <span className="flex items-center gap-1" title="Criteria">
            <ListChecks className="h-3 w-3" />
            {criteriaCount ?? '…'}
          </span>
        </div>
        <span className="flex items-center gap-1 text-white/20 transition-colors group-hover:text-white/50">
          Manage
          <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}
