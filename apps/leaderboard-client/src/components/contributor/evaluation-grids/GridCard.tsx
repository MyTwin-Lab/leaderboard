'use client';

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
    <button onClick={onOpen} className="v-pro-grid-card">
      <span className="v-pro-grid-tags">
        <span className="v-pro-type">{grid.status}</span>
        <span className="v-pro-grid-slug">{grid.slug}</span>
      </span>

      <span className="v-pro-grid-name">{grid.name}</span>

      {grid.description && <span className="v-pro-grid-meta">{grid.description}</span>}

      <span className="v-pro-grid-meta">
        {categoriesCount ?? '…'} categories · {criteriaCount ?? '…'} criteria
      </span>
    </button>
  );
}
