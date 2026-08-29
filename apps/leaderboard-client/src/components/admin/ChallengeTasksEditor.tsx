'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ListTodo } from 'lucide-react';

interface TaskItem {
  uuid: string;
  title: string;
  status: string;
  parent_task_id?: string;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Template task management for a code challenge, embedded in the edit drawer.
 * These are the tasks copied to a contributor's personal board when they join
 * — not the tasks themselves, which live on each contributor's own board and
 * have no shared progress to show here.
 * Tasks are independent entities: each add/delete hits the API immediately,
 * it is not tied to the challenge's "Save changes" button.
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
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <ListTodo className="h-3.5 w-3.5" />
        Template tasks
        <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
          {parents.length}
        </span>
      </p>
      <p className="-mt-2 text-xs" style={{ color: fgAt(0.3) }}>
        Copied to each contributor&apos;s personal board when they join.
      </p>

      {/* Existing tasks */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : parents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
          No template task yet. Add the first one below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {parents.map(task => (
            <div key={task.uuid} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>
                {task.title}
              </span>
              <button
                onClick={() => handleDelete(task.uuid)}
                disabled={deletingId === task.uuid}
                className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                aria-label="Delete task"
              >
                {deletingId === task.uuid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !adding) handleAdd(); }}
          placeholder="New template task title…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
          style={{ color: 'var(--foreground)' }}
        />

        <div className="flex items-center justify-end">
          <button
            onClick={handleAdd}
            disabled={adding || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
