'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson } from '@/lib/fetchJson';
import {
  ArrowLeft, CheckCircle2, Circle, ChevronRight,
  Pencil, Check, X, Plus, Trash2, Loader2,
} from 'lucide-react';

type TaskStatus = 'todo' | 'in_progress' | 'done';

interface TaskRecord {
  uuid: string;
  challenge_id: string;
  user_id?: string | null;
  parent_task_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  created_at: string;
}

interface TaskDetails {
  task: TaskRecord;
  subTasks: TaskRecord[];
}

const STATUS_OPTIONS: { key: TaskStatus; label: string; dot: string }[] = [
  { key: 'todo',        label: 'To do',       dot: 'bg-white/25' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-yellow-400' },
  { key: 'done',        label: 'Done',        dot: 'bg-green-500' },
];

// Distinct error class so the query's error message can carry the 404 vs
// generic-failure distinction the page derives from `res.status`.
class TaskDetailsError extends Error {
  constructor(public status: number) { super(`Task details request failed with ${status}`); }
}

async function patchTask(taskId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Update failed');
  }
  return res.json();
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const taskId = params.id as string;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchJson('/api/contributors/me'),
    staleTime: 5 * 60_000,
  });

  const detailsQuery = useQuery({
    queryKey: ['task-details', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/details`);
      if (!res.ok) throw new TaskDetailsError(res.status);
      return res.json() as Promise<TaskDetails>;
    },
    enabled: !!taskId,
    retry: false,
  });

  // ── Header edit state ──────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingField, setSavingField] = useState<'title' | 'description' | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Sub-tasks state ─────────────────────────────────────────────────────
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [subtaskBusy, setSubtaskBusy] = useState<Record<string, boolean>>({});

  // ── Danger zone ──────────────────────────────────────────────────────────
  const [deletingTask, setDeletingTask] = useState(false);

  const data = detailsQuery.data ?? null;
  const loading = detailsQuery.isLoading || meQuery.isLoading;
  const error = detailsQuery.isError
    ? ((detailsQuery.error as TaskDetailsError)?.status === 404 ? 'Task not found' : 'Failed to load task')
    : null;

  const refetchDetails = () => queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse space-y-6 pt-2">
        <div className="h-4 w-24 rounded-full bg-white/8" />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-7 w-24 rounded-full bg-white/8" />)}
        </div>
        <div className="space-y-3">
          <div className="h-8 w-2/3 rounded-xl bg-white/10" />
          <div className="h-3 w-full max-w-lg rounded-full bg-white/6" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-white/40 text-sm">
        {error || 'Task not found.'}
      </div>
    );
  }

  const { task, subTasks } = data;
  const currentUserId = meQuery.data?.user?.id ?? null;
  const isAdmin = meQuery.data?.user?.role === 'admin';
  const canEdit = isAdmin || (!!task.user_id && task.user_id === currentUserId);

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    setSavingField('title');
    try {
      await patchTask(taskId, { title: trimmed });
      await refetchDetails();
      setEditingTitle(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update title');
    } finally {
      setSavingField(null);
    }
  };

  const saveDescription = async () => {
    setSavingField('description');
    try {
      await patchTask(taskId, { description: descriptionDraft.trim() });
      await refetchDetails();
      setEditingDescription(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update description');
    } finally {
      setSavingField(null);
    }
  };

  const changeStatus = async (status: TaskStatus) => {
    if (status === task.status || statusSaving) return;
    setStatusSaving(true);
    try {
      await patchTask(taskId, { status });
      await refetchDetails();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const toggleSubtask = async (sub: TaskRecord) => {
    if (subtaskBusy[sub.uuid]) return;
    const next: TaskStatus = sub.status === 'done' ? 'todo' : 'done';
    setSubtaskBusy(b => ({ ...b, [sub.uuid]: true }));
    try {
      await patchTask(sub.uuid, { status: next });
      await refetchDetails();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update sub-task');
    } finally {
      setSubtaskBusy(b => { const n = { ...b }; delete n[sub.uuid]; return n; });
    }
  };

  const addSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title || creatingSubtask) return;
    setCreatingSubtask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: task.challenge_id, parent_task_id: task.uuid, title }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add sub-task');
      }
      setSubtaskTitle('');
      setAddingSubtask(false);
      await refetchDetails();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add sub-task');
    } finally {
      setCreatingSubtask(false);
    }
  };

  const deleteSubtask = async (sub: TaskRecord) => {
    if (!confirm('Delete this sub-task? This cannot be undone.')) return;
    setSubtaskBusy(b => ({ ...b, [sub.uuid]: true }));
    try {
      const res = await fetch(`/api/tasks/${sub.uuid}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete sub-task');
      }
      await refetchDetails();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete sub-task');
      setSubtaskBusy(b => { const n = { ...b }; delete n[sub.uuid]; return n; });
    }
  };

  const deleteTask = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to delete task');
        setDeletingTask(false);
        return;
      }
      router.push(`/challenges/${task.challenge_id}`);
    } catch {
      alert('Network error');
      setDeletingTask(false);
    }
  };

  const doneCount = subTasks.filter(s => s.status === 'done').length;

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">

      {/* ── Back ── */}
      <button
        onClick={() => router.back()}
        className="group mb-6 flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back
      </button>

      {/* ── Header ── */}
      <div className="mb-10 space-y-4">
        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map(opt => {
            const active = task.status === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => changeStatus(opt.key)}
                disabled={!canEdit || statusSaving}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? opt.key === 'done' ? 'bg-green-500/15 text-green-400'
                      : opt.key === 'in_progress' ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-white/10 text-white/70'
                    : 'bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                {opt.label}
              </button>
            );
          })}
          <Link
            href={`/challenges/${task.challenge_id}`}
            className="ml-auto text-xs text-white/30 transition-colors hover:text-brandCP"
          >
            View challenge
          </Link>
        </div>

        {/* Title */}
        {editingTitle ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && savingField !== 'title') saveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-2xl font-bold text-white focus:border-brandCP/40 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveTitle}
                disabled={savingField === 'title' || !titleDraft.trim()}
                className="flex items-center gap-1 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingField === 'title' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                disabled={savingField === 'title'}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/70 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group flex items-start gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{task.title}</h1>
            {canEdit && (
              <button
                onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                className="mt-1 shrink-0 rounded-lg p-1 text-white/0 transition-all hover:bg-white/[0.06] hover:text-white/60 group-hover:text-white/30"
                aria-label="Edit title"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Description */}
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              rows={3}
              value={descriptionDraft}
              onChange={e => setDescriptionDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditingDescription(false); }}
              placeholder="Description (optional)"
              className="w-full max-w-2xl resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 placeholder:text-white/25 focus:border-brandCP/40 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveDescription}
                disabled={savingField === 'description'}
                className="flex items-center gap-1 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingField === 'description' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                onClick={() => setEditingDescription(false)}
                disabled={savingField === 'description'}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/70 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group flex items-start gap-2">
            {task.description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-white/50">{task.description}</p>
            ) : (
              <p className="max-w-2xl text-sm italic leading-relaxed text-white/25">No description</p>
            )}
            {canEdit && (
              <button
                onClick={() => { setDescriptionDraft(task.description ?? ''); setEditingDescription(true); }}
                className="mt-0.5 shrink-0 rounded-lg p-1 text-white/0 transition-all hover:bg-white/[0.06] hover:text-white/60 group-hover:text-white/30"
                aria-label="Edit description"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-white/30">
          Created {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* ── Sub-tasks ── */}
      <div className="mb-10 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sub-tasks
          </h2>
          {subTasks.length > 0 && (
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">
              {doneCount}/{subTasks.length}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => setAddingSubtask(v => !v)}
              className="ml-auto flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/50 transition-colors hover:bg-white/[0.14] hover:text-white/80"
            >
              {addingSubtask ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          )}
        </div>

        {addingSubtask && (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
            <input
              autoFocus
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !creatingSubtask) addSubtask();
                if (e.key === 'Escape') setAddingSubtask(false);
              }}
              placeholder="Sub-task title…"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-white placeholder:text-white/25 focus:border-brandCP/40 focus:outline-none"
            />
            <button
              onClick={addSubtask}
              disabled={creatingSubtask || !subtaskTitle.trim()}
              className="flex items-center gap-1 rounded-lg bg-brandCP/15 px-2.5 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creatingSubtask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        {subTasks.length === 0 && !addingSubtask ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-10 text-center">
            <CheckCircle2 className="h-6 w-6 text-white/15" />
            <p className="text-xs text-white/25">No sub-tasks yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {subTasks.map(st => {
              const busy = !!subtaskBusy[st.uuid];
              const done = st.status === 'done';
              return (
                <div
                  key={st.uuid}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-all duration-200 hover:border-white/12 hover:bg-white/[0.04]"
                >
                  <button
                    onClick={() => toggleSubtask(st)}
                    disabled={!canEdit || busy}
                    className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={done ? 'Mark as to do' : 'Mark as done'}
                  >
                    {done
                      ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                      : <Circle className="h-5 w-5 text-white/25" />}
                  </button>
                  <span className={`flex-1 truncate text-sm ${done ? 'text-white/35 line-through decoration-white/20' : 'text-white'}`}>
                    {st.title}
                  </span>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />
                  ) : canEdit ? (
                    <button
                      onClick={() => deleteSubtask(st)}
                      className="shrink-0 rounded-lg p-1 text-white/0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:text-white/25"
                      aria-label="Delete sub-task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Danger zone ── */}
      {canEdit && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-400/70">Danger zone</h2>
          <p className="mb-3 text-xs text-white/40">This cannot be undone.</p>
          <button
            onClick={deleteTask}
            disabled={deletingTask}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {deletingTask ? 'Deleting…' : 'Delete task'}
          </button>
        </div>
      )}
    </div>
  );
}
