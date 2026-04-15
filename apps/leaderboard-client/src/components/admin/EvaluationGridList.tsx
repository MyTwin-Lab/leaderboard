'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { EvaluationGrid } from '../../../../../packages/database-service/domain/entities';

interface EvaluationGridListProps {
  grids: EvaluationGrid[];
  onEdit: (grid: EvaluationGrid) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-500/10 text-yellow-400',
  published: 'bg-green-500/10 text-green-400',
  archived: 'bg-white/10 text-white/50',
};

export function EvaluationGridList({ grids, onEdit, onDelete, onPublish }: EvaluationGridListProps) {
  if (grids.length === 0) {
    return <p className="py-8 text-center text-sm text-white/40">No evaluation grids found</p>;
  }

  return (
    <div className="divide-y divide-white/5">
      {grids.map((grid) => (
        <div key={grid.uuid} className="flex items-center justify-between gap-4 px-3 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-white">{grid.name}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
                {grid.slug}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[grid.status] ?? 'bg-white/10 text-white/60'}`}
              >
                {grid.status}
              </span>
              <span className="text-xs text-white/40">v{grid.version}</span>
            </div>
            {grid.description && (
              <p className="mt-1 truncate text-xs text-white/40">{grid.description}</p>
            )}
            <div className="mt-1 text-xs text-white/30">
              Updated {new Date(grid.updated_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/admin/evaluation-grids/${grid.uuid}`}>
              <Button variant="secondary" size="sm">Criteria</Button>
            </Link>
            {grid.status === 'draft' && (
              <Button variant="secondary" size="sm" onClick={() => onPublish(grid.uuid)}>
                Publish
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(grid)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(grid.uuid)}>
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
