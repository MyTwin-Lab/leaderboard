'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ListTodo } from 'lucide-react';

interface TaskItem {
  uuid: string;
  title: string;
  status: string;
  parent_task_id?: string;
}

/**
 * Template task management for a code challenge, embedded in the edit drawer.
 * These are the tasks copied to a contributor's personal board when they join
 * — not the tasks themselves, which live on each contributor's own board and
 * have no shared progress to show here.
 * Tasks are independent entities: each add/delete hits the API immediately,
 * it is not tied to the challenge's "Save changes" button.
 *
 * Sur le vocabulaire vitrine des tiroirs (`components/vitrine/forms-vitrine.css`).
 */
export function ChallengeTasksEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Refetch each time the drawer opens (avoids showing stale tasks).
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchTasks();
  }, [open]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?challenge_id=${challengeId}&scope=template`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!title.trim()) { setError('Task title is required.'); return; }
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          title: title.trim(),
          template: true,
        }),
      });
      if (res.ok) {
        setTitle('');
        await fetchTasks();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add task');
      }
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchTasks();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to delete task'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  const parents = tasks.filter(t => !t.parent_task_id);

  return (
    <div className="v-field">
      <p className="v-label">
        <ListTodo />
        Template tasks
        <span className="v-badge">{parents.length}</span>
      </p>
      <p className="v-help" data-size="xs">
        Copied to each contributor&apos;s personal board when they join.
      </p>

      {/* Existing tasks */}
      {loading ? (
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" /> Loading…
        </div>
      ) : parents.length === 0 ? (
        <p className="v-alert" data-tone="info">
          No template task yet. Add the first one below.
        </p>
      ) : (
        <div className="v-rows">
          {parents.map(task => (
            <div key={task.uuid} className="v-row">
              <div className="v-row-text">
                <span className="v-row-title">{task.title}</span>
              </div>
              <div className="v-row-actions">
                <button
                  type="button"
                  onClick={() => handleDelete(task.uuid)}
                  disabled={deletingId === task.uuid}
                  className="v-btn-icon"
                  data-tone="danger"
                  aria-label="Delete task"
                >
                  {deletingId === task.uuid ? <Loader2 className="v-spin" /> : <Trash2 />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="v-section">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !adding) handleAdd(); }}
          placeholder="New template task title…"
          className="v-input"
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !title.trim()}
            className="v-btn v-btn-sm"
          >
            {adding ? <Loader2 className="v-spin" /> : <Plus />}
            Add
          </button>
        </div>
      </div>

      {error && (
        <p className="v-alert">{error}</p>
      )}
    </div>
  );
}
