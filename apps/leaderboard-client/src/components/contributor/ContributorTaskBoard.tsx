'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, pointerWithin,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Loader2, MoreVertical, Trash2, Plus, X } from 'lucide-react';
import { trackOnboardingStep } from '@/lib/onboarding-track';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BoardTask {
  uuid: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  parent_task_id?: string;
}

type ColKey = 'todo' | 'in_progress' | 'done';

const COLUMNS: { key: ColKey; label: string; dot: string }[] = [
  { key: 'todo',        label: 'To do',       dot: 'bg-white/25' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-yellow-400' },
  { key: 'done',        label: 'Done',        dot: 'bg-green-500' },
];

// ─── Board ────────────────────────────────────────────────────────────────────

export function ContributorTaskBoard({
  challengeId, tasks, onReload,
}: {
  challengeId: string;
  tasks: BoardTask[];
  onReload: () => Promise<void> | void;
}) {
  const router = useRouter();
  // Per-task target status while a PATCH is in flight — drives the optimistic
  // column placement below and the card's "Moving…" spinner.
  const [pending, setPending] = useState<Record<string, ColKey>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Parent tasks only — subtasks are handled inside the task page.
  const parents = tasks.filter(t => !t.parent_task_id);

  // Where a card sits, factoring in an in-flight optimistic move.
  const columnOf = (t: BoardTask): ColKey => pending[t.uuid] ?? t.status;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const runStatusChange = async (taskId: string, status: ColKey) => {
    setPending(p => ({ ...p, [taskId]: status }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to move task'); return; }
      await onReload();
    } catch { alert('Network error'); }
    finally { setPending(p => { const n = { ...p }; delete n[taskId]; return n; }); }
  };

  const runCreate = async (title: string, description: string) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, title, description: description || undefined }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to create task');
    }
    // Onboarding's "got to work" step is now keyed off creating your first
    // personal task rather than self-assigning one — marking it is idempotent.
    trackOnboardingStep('assigned_task');
    await onReload();
  };

  const runDelete = async (taskId: string) => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(d => ({ ...d, [taskId]: true }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to delete task'); return; }
      await onReload();
    } catch { alert('Network error'); }
    finally { setDeleting(d => { const n = { ...d }; delete n[taskId]; return n; }); }
  };

  // ── Drag handling ────────────────────────────────────────────────────────────
  // Every column pair is a valid move — todo ↔ in_progress ↔ done, either
  // direction — since a board is just a view over the stored status.

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = parents.find(t => t.uuid === String(active.id));
    if (!task) return;
    const to = String(over.id) as ColKey;
    if (task.status !== to) runStatusChange(task.uuid, to);
  };

  const activeTask = activeId ? parents.find(t => t.uuid === activeId) ?? null : null;

  const openMenu = (taskId: string, x: number, y: number) => setMenu({ taskId, x, y });

  const grouped: Record<ColKey, BoardTask[]> = { todo: [], in_progress: [], done: [] };
  for (const t of parents) grouped[columnOf(t)].push(t);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
        {COLUMNS.map(col => (
          <Column
            key={col.key}
            col={col}
            count={grouped[col.key].length}
            headerRight={col.key === 'todo' ? (
              <button
                onClick={() => setAddingTask(v => !v)}
                className="flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/50 transition-colors hover:bg-white/[0.14] hover:text-white/80"
              >
                {addingTask ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                New task
              </button>
            ) : undefined}
          >
            {col.key === 'todo' && addingTask && (
              <NewTaskForm
                onCancel={() => setAddingTask(false)}
                onCreate={async (title, description) => { await runCreate(title, description); setAddingTask(false); }}
              />
            )}
            {grouped[col.key].map(task => (
              <Card
                key={task.uuid}
                task={task}
                pending={pending[task.uuid]}
                deleting={!!deleting[task.uuid]}
                draggable={!pending[task.uuid] && !deleting[task.uuid]}
                onOpen={() => router.push(`/tasks/${task.uuid}`)}
                onOpenMenu={openMenu}
              />
            ))}
            {grouped[col.key].length === 0 && !(col.key === 'todo' && addingTask) && (
              <div className="flex h-20 items-center justify-center rounded-[14px] border border-dashed border-white/[0.05]">
                <p className="text-xs text-white/15">Empty</p>
              </div>
            )}
          </Column>
        ))}
      </div>

      <p className="mt-3 text-xs text-white/30">
        Drag cards across columns to track your progress. Finish everything to unlock the evaluation.
      </p>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardShell task={activeTask} dragging /> : null}
      </DragOverlay>

      {menu && parents.some(t => t.uuid === menu.taskId) && (
        <DeleteMenu
          x={menu.x}
          y={menu.y}
          busy={!!deleting[menu.taskId]}
          onClose={() => setMenu(null)}
          onDelete={() => { const id = menu.taskId; setMenu(null); runDelete(id); }}
        />
      )}
    </DndContext>
  );
}

// ─── Column (droppable) ───────────────────────────────────────────────────────

function Column({
  col, count, headerRight, children,
}: {
  col: { key: ColKey; label: string; dot: string };
  count: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="min-w-[80vw] shrink-0 snap-center space-y-3 md:min-w-0 md:shrink">
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
        <span className="text-xs font-semibold text-white/50">{col.label}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/30">{count}</span>
          {headerRight}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[140px] space-y-2 rounded-[20px] border p-2.5 transition-colors ${
          isOver ? 'border-brandCP/30 bg-brandCP/[0.04]' : 'border-white/[0.06] bg-white/[0.01]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Card (draggable) ─────────────────────────────────────────────────────────

function Card({
  task, pending, deleting, draggable, onOpen, onOpenMenu,
}: {
  task: BoardTask;
  pending?: ColKey;
  deleting: boolean;
  draggable: boolean;
  onOpen: () => void;
  onOpenMenu: (taskId: string, x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.uuid, disabled: !draggable });

  const busy = !!pending || deleting;

  // Swallow the click that a browser fires right after a drag so we don't navigate.
  const wasDragging = useRef(false);
  useEffect(() => { if (isDragging) wasDragging.current = true; }, [isDragging]);
  const handleClick = () => {
    if (wasDragging.current) { wasDragging.current = false; return; }
    if (!busy) onOpen();
  };

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={handleClick}
      className={`group select-none rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 transition-all
        ${isDragging ? 'opacity-40' : 'hover:border-white/12 hover:bg-white/[0.05]'}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{ touchAction: draggable ? 'none' : undefined }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <CardShell task={task} />
        </div>
        <button
          disabled={busy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenMenu(task.uuid, e.clientX, e.clientY); }}
          className="shrink-0 rounded-lg p-1 text-white/25 opacity-100 transition-all hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Task actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {pending && <LoadingLine label="Moving…" />}
      {deleting && <LoadingLine label="Deleting…" />}
    </div>
  );
}

// The visual shell, reused by the drag overlay.
function CardShell({ task, dragging }: { task: BoardTask; dragging?: boolean }) {
  return (
    <div className={dragging ? 'w-[280px] max-w-[80vw] rounded-xl border border-brandCP/30 bg-backgroundDark px-3.5 py-3 shadow-2xl' : ''}>
      <p className="text-sm font-medium leading-snug text-white">{task.title}</p>
      {task.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-white/35">{task.description}</p>
      )}
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-brandCP" />
      {label}
    </div>
  );
}

// ─── Inline task creation ─────────────────────────────────────────────────────

function NewTaskForm({
  onCancel, onCreate,
}: {
  onCancel: () => void;
  onCreate: (title: string, description: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreate(title.trim(), description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !saving) submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Task title…"
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-white placeholder:text-white/25 focus:border-brandCP/40 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none"
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-2.5 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/70 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Card action popup (delete) ────────────────────────────────────────────────

function DeleteMenu({
  x, y, busy, onClose, onDelete,
}: {
  x: number; y: number; busy: boolean;
  onClose: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Keep the popup within the viewport horizontally.
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 320) - 200);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: y + 8, left, zIndex: 9999 }}
      className="w-44 rounded-xl border border-white/10 bg-backgroundDark p-1.5 shadow-2xl"
    >
      <button
        disabled={busy}
        onClick={onDelete}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/[0.1] hover:text-red-300 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4 shrink-0 text-red-400/70" />
        Delete
      </button>
    </div>
  );
}
