'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EvaluationGridList } from '@/components/admin/EvaluationGridList';
import { EvaluationGridForm } from '@/components/admin/EvaluationGridForm';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { EvaluationGrid } from '../../../../../../packages/database-service/domain/entities';

export default function EvaluationGridsPage() {
  const [grids, setGrids] = useState<EvaluationGrid[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGrid, setEditingGrid] = useState<EvaluationGrid | undefined>();
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchGrids();
  }, []);

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/evaluation-grids');
      const data = await res.json();
      setGrids(data);
    } catch {
      toast('Failed to load evaluation grids', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch('/api/evaluation-grids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchGrids();
        setShowForm(false);
        toast('Evaluation grid created', 'success');
      } else {
        toast('Failed to create grid', 'error');
      }
    } catch {
      toast('Failed to create grid', 'error');
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingGrid) return;

    try {
      const res = await fetch(`/api/evaluation-grids/${editingGrid.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchGrids();
        setShowForm(false);
        setEditingGrid(undefined);
        toast('Evaluation grid updated', 'success');
      } else {
        toast('Failed to update grid', 'error');
      }
    } catch {
      toast('Failed to update grid', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Evaluation Grid',
      message: 'This will permanently delete the grid and all its categories and criteria. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/evaluation-grids/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchGrids();
        toast('Evaluation grid deleted', 'success');
      } else {
        toast('Failed to delete grid', 'error');
      }
    } catch {
      toast('Failed to delete grid', 'error');
    }
  };

  const handleEdit = (grid: EvaluationGrid) => {
    setEditingGrid(grid);
    setShowForm(true);
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/evaluation-grids/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', published_at: new Date().toISOString() }),
      });

      if (res.ok) {
        await fetchGrids();
        toast('Grid published', 'success');
      } else {
        toast('Failed to publish grid', 'error');
      }
    } catch {
      toast('Failed to publish grid', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingGrid(undefined);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <Card title={editingGrid ? 'Edit Evaluation Grid' : 'New Evaluation Grid'}>
          <EvaluationGridForm
            grid={editingGrid}
            onSubmit={editingGrid ? handleUpdate : handleCreate}
            onCancel={handleCancel}
          />
        </Card>
      ) : (
        <Card
          title="Evaluation Grids"
          count={grids.length}
          className="rounded-md"
          action={
            <Button onClick={() => setShowForm(true)}>+ New Grid</Button>
          }
        >
          <EvaluationGridList
            grids={grids}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPublish={handlePublish}
          />
        </Card>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-white/5" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
