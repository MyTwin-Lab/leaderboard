'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EvaluationGridList } from '@/components/admin/EvaluationGridList';
import { EvaluationGridForm } from '@/components/admin/EvaluationGridForm';
import type { EvaluationGrid } from '../../../../../../packages/database-service/domain/entities';

export default function EvaluationGridsPage() {
  const [grids, setGrids] = useState<EvaluationGrid[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGrid, setEditingGrid] = useState<EvaluationGrid | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGrids();
  }, []);

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/evaluation-grids');
      const data = await res.json();
      setGrids(data);
    } catch (error) {
      console.error('Error fetching grids:', error);
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
      }
    } catch (error) {
      console.error('Error creating grid:', error);
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
      }
    } catch (error) {
      console.error('Error updating grid:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this evaluation grid?')) return;

    try {
      const res = await fetch(`/api/evaluation-grids/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchGrids();
      }
    } catch (error) {
      console.error('Error deleting grid:', error);
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
      }
    } catch (error) {
      console.error('Error publishing grid:', error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingGrid(undefined);
  };

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
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
          className="rounded-md"
          action={
            <Button onClick={() => setShowForm(true)}>
              + New Grid
            </Button>
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
