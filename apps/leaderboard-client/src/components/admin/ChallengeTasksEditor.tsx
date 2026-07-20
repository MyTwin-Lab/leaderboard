'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ListTodo, Users, User } from 'lucide-react';

interface TaskItem {
  uuid: string;
  title: string;
  type: 'solo' | 'concurrent';
  status: string;
  parent_task_id?: string;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Task management for a code challenge, embedded in the edit drawer.
 * Tasks are independent entities: each add/delete hits the API immediately,
 * it is not tied to the challenge's "Save changes" button.
 */
export function ChallengeTasksEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  // A code challenge has a single repo, fixed at creation. We force it on every
  // task rather than letting the manager pick one.
  const [forcedRepoId, setForcedRepoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'solo' | 'concurrent'>('solo');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Refetch each time the drawer opens (avoids showing stale tasks).
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchAll();
  }, [open]);

  const fetchTasks = async () => {
    const res = await fetch(`/api/tasks?challenge_id=${challengeId}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTasks(),
        fetch(`/api/challenges/${challengeId}/repos`).then(r => r.ok && r.json()).then(d => {
          if (Array.isArray(d) && d.length > 0) setForcedRepoId(d[0].repo_id ?? '');
        }),
      ]);
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
          type,
          repo_id: forcedRepoId || undefined,
        }),
      });
      if (res.ok) {
        setTitle('');
        setType('solo');
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
        Tasks
        <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
          {parents.length}
        </span>
      </p>

      {/* Existing tasks */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : parents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
          No task yet. Add the first one below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {parents.map(task => {
            const isDone = task.status === 'done' || task.status === 'completed';
            const TypeIcon = task.type === 'concurrent' ? Users : User;
            return (
              <div key={task.uuid} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDone ? 'bg-green-500' : 'bg-white/25'}`} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(isDone ? 0.4 : 0.75) }}>
                  {task.title}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: fgAt(0.3) }}>
                  <TypeIcon className="h-3 w-3" />
                  {task.type}
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
            );
          })}
        </div>
      )}

      {/* Add form */}
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !adding) handleAdd(); }}
          placeholder="New task title…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
          style={{ color: 'var(--foreground)' }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Type toggle */}
          {([
            { value: 'solo', label: 'Solo', icon: User },
            { value: 'concurrent', label: 'Concurrent', icon: Users },
          ] as const).map(opt => {
            const Icon = opt.icon;
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  active ? 'border-brandCP/40 bg-brandCP/10 text-brandCP' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                }`}
                style={active ? undefined : { color: fgAt(0.5) }}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}

          <button
            onClick={handleAdd}
            disabled={adding || !title.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
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
