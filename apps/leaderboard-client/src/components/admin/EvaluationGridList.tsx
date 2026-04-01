'use client';

import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Trash2, List, CheckCircle } from 'lucide-react';
import type { EvaluationGrid } from '../../../../../packages/database-service/domain/entities';

interface EvaluationGridListProps {
  grids: EvaluationGrid[];
  onEdit: (grid: EvaluationGrid) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

export function EvaluationGridList({ grids, onEdit, onDelete, onPublish }: EvaluationGridListProps) {
  const columns = [
    {
      key: 'name',
      header: 'Grid',
      render: (grid: EvaluationGrid) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{grid.name}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/40 font-mono">
              {grid.slug}
            </span>
            <span className="text-xs text-white/30">v{grid.version}</span>
          </div>
          {grid.description && (
            <div className="mt-0.5 text-xs text-white/40 truncate max-w-xs">{grid.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (grid: EvaluationGrid) => <Badge label={grid.status} />,
      width: '110px',
    },
    {
      key: 'updated_at',
      header: 'Updated',
      render: (grid: EvaluationGrid) => (
        <div className="text-sm text-white/50">
          {new Date(grid.updated_at).toLocaleDateString('fr-FR')}
        </div>
      ),
      width: '110px',
    },
    {
      key: 'actions',
      header: '',
      render: (grid: EvaluationGrid) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/evaluation-grids/${grid.uuid}`}>
            <Button variant="secondary" size="sm" title="Manage criteria">
              <List className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {grid.status === 'draft' && (
            <Button variant="secondary" size="sm" onClick={() => onPublish(grid.uuid)} title="Publish">
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(grid)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(grid.uuid)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: '150px',
    },
  ];

  return <Table data={grids} columns={columns} emptyMessage="No evaluation grids yet" />;
}
