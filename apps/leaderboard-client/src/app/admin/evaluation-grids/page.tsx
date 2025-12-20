'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table } from '@/components/ui/Table';
import { EvaluationGridEditor } from '@/components/admin/EvaluationGridEditor';

interface EvaluationGrid {
  uuid: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  status: string;
  instructions?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export default function EvaluationGridsPage() {
  const [grids, setGrids] = useState<EvaluationGrid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGridData, setNewGridData] = useState({ slug: '', name: '', description: '' });

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  useEffect(() => {
    fetchGrids();
  }, [filterStatus, filterSearch]);

  const fetchGrids = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSearch) params.set('search', filterSearch);

      const res = await fetch(`/api/admin/evaluation-grids?${params}`);
      const data = await res.json();
      setGrids(data.grids || []);
    } catch (error) {
      console.error('Error fetching grids:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newGridData.slug || !newGridData.name) {
      alert('Slug and name are required');
      return;
    }

    try {
      const res = await fetch('/api/admin/evaluation-grids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGridData),
      });

      if (res.ok) {
        const grid = await res.json();
        setShowCreateForm(false);
        setNewGridData({ slug: '', name: '', description: '' });
        setSelectedGridId(grid.uuid);
        fetchGrids();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating grid:', error);
      alert('Error creating grid');
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('Publish this grid? This will increment the version.')) return;

    try {
      const res = await fetch(`/api/admin/evaluation-grids/${id}/publish`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchGrids();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error publishing grid:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    const newSlug = prompt('Enter slug for the duplicate:');
    if (!newSlug) return;

    try {
      const res = await fetch(`/api/admin/evaluation-grids/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSlug }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setSelectedGridId(data.grid.uuid);
        fetchGrids();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error duplicating grid:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this grid? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/admin/evaluation-grids/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchGrids();
        if (selectedGridId === id) {
          setSelectedGridId(null);
        }
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting grid:', error);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (grid: EvaluationGrid) => (
        <div>
          <div className="font-medium">{grid.name}</div>
          <div className="text-xs text-white/50">{grid.slug}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (grid: EvaluationGrid) => <StatusBadge status={grid.status} />,
      width: '120px',
    },
    {
      key: 'version',
      header: 'Version',
      render: (grid: EvaluationGrid) => (
        <span className="font-medium text-brandCP">v{grid.version}</span>
      ),
      width: '80px',
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (grid: EvaluationGrid) => (
        <span className="text-white/70 text-sm">
          {new Date(grid.updated_at).toLocaleDateString('fr-FR')}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (grid: EvaluationGrid) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelectedGridId(grid.uuid)}>
            ✏️
          </Button>
          {grid.status === 'draft' && (
            <Button size="sm" variant="secondary" onClick={() => handlePublish(grid.uuid)}>
              🚀
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleDuplicate(grid.uuid)}>
            📋
          </Button>
          {grid.status !== 'published' && (
            <Button size="sm" variant="danger" onClick={() => handleDelete(grid.uuid)}>
              🗑️
            </Button>
          )}
        </div>
      ),
      width: '160px',
    },
  ];

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
  }

  // Show editor if a grid is selected
  if (selectedGridId) {
    return (
      <EvaluationGridEditor
        gridId={selectedGridId}
        onClose={() => {
          setSelectedGridId(null);
          fetchGrids();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search grids..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-brandCP focus:outline-none"
        />
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <Button variant="secondary" size="sm" onClick={() => { setFilterStatus(''); setFilterSearch(''); }}>
          Clear
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm ? (
        <Card title="New Evaluation Grid" className="rounded-md">
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">Slug</label>
              <input
                type="text"
                value={newGridData.slug}
                onChange={(e) => setNewGridData({ ...newGridData, slug: e.target.value })}
                placeholder="e.g., code, model, dataset"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Name</label>
              <input
                type="text"
                value={newGridData.name}
                onChange={(e) => setNewGridData({ ...newGridData, name: e.target.value })}
                placeholder="e.g., Code Contribution Grid"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Description</label>
              <textarea
                value={newGridData.description}
                onChange={(e) => setNewGridData({ ...newGridData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brandCP focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="secondary" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          title="Evaluation Grids"
          className="rounded-md"
          action={
            <Button onClick={() => setShowCreateForm(true)}>
              + New Grid
            </Button>
          }
        >
          <Table data={grids} columns={columns} emptyMessage="No evaluation grids found" />
        </Card>
      )}
    </div>
  );
}
