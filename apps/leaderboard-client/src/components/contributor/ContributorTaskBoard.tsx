'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, pointerWithin,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Loader2, MoreVertical, RotateCw, Check, CheckCircle2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { trackOnboardingStep } from '@/lib/onboarding-track';
import type { TeamMember } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BoardTask {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  status: string;
  parent_task_id?: string;
  assignees: TeamMember[];
}

export interface BoardContribution {
  uuid: string;
  task_id?: string;
  user_id: string;
  evaluation?: { globalScore?: number } | null;
  reward: number;
  submitted_at: string;
}

type ColKey = 'todo' | 'in_progress' | 'done';
type Pending = 'assigning' | 'evaluating' | 'validating';

const COLUMNS: { key: ColKey; label: string; dot: string }[] = [
  { key: 'todo',        label: 'To do',       dot: 'bg-white/25' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-yellow-400' },
  { key: 'done',        label: 'Done',        dot: 'bg-green-500' },
];

// ─── Small mobile detector ────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function ContributorTaskBoard({
  challengeId, tasks, contributions, currentUserId, isAdmin, onReload,
}: {
  challengeId: string;
  tasks: BoardTask[];
  contributions: BoardContribution[];
  currentUserId: string | null;
  isAdmin: boolean;
  onReload: () => Promise<void> | void;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Parent tasks only — subtasks are handled inside the task page.
  const parents = tasks.filter(t => !t.parent_task_id);

  const evalFor = (taskId: string) =>
    contributions.find(c => c.task_id === taskId && c.evaluation);

  const isAssigned = (t: BoardTask) => !!currentUserId && t.assignees.some(a => a.id === currentUserId);
  const canActOn = (t: BoardTask) => isAdmin || isAssigned(t);

  // Where a card sits, factoring in an in-flight optimistic move.
  const columnOf = (t: BoardTask): ColKey => {
    const p = pending[t.uuid];
    if (p === 'assigning') return 'in_progress';
    if (p === 'evaluating' || p === 'validating') return 'done';
    if (t.status === 'done') return 'done';
    if (evalFor(t.uuid)) return 'done';
    if (t.assignees.length > 0) return 'in_progress';
    return 'todo';
  };

  const isDraggable = (t: BoardTask): boolean => {
    if (pending[t.uuid]) return false;
    const col = columnOf(t);
    if (col === 'todo') return true;                 // drag = assign self
    if (col === 'in_progress') return canActOn(t);   // drag = evaluate
    return false;
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const runAssign = async (taskId: string) => {
    setPending(p => ({ ...p, [taskId]: 'assigning' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to assign'); return; }
      trackOnboardingStep('assigned_task');
      await onReload();
    } catch { alert('Network error'); }
    finally { setPending(p => { const n = { ...p }; delete n[taskId]; return n; }); }
  };

  const runEvaluate = async (taskId: string) => {
    setPending(p => ({ ...p, [taskId]: 'evaluating' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}/evaluate`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Evaluation failed'); return; }
      await onReload();
    } catch { alert('Evaluation failed'); }
    finally { setPending(p => { const n = { ...p }; delete n[taskId]; return n; }); }
  };

  const runValidate = async (taskId: string) => {
    setPending(p => ({ ...p, [taskId]: 'validating' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to validate'); return; }
      await onReload();
    } catch { alert('Network error'); }
    finally { setPending(p => { const n = { ...p }; delete n[taskId]; return n; }); }
  };

  // ── Drag handling ────────────────────────────────────────────────────────────

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = parents.find(t => t.uuid === String(active.id));
    if (!task) return;
    const from = columnOf(task);
    const to = String(over.id) as ColKey;
    if (from === to) return;
    if (from === 'todo' && to === 'in_progress') runAssign(task.uuid);
    else if (from === 'in_progress' && to === 'done' && canActOn(task)) runEvaluate(task.uuid);
    // any other transition is ignored → card snaps back
  };

  const activeTask = activeId ? parents.find(t => t.uuid === activeId) ?? null : null;

  const openMenu = (taskId: string, x: number, y: number) => setMenu({ taskId, x, y });

  const grouped: Record<ColKey, BoardTask[]> = { todo: [], in_progress: [], done: [] };
  for (const t of parents) grouped[columnOf(t)].push(t);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
        {COLUMNS.map(col => (
          <Column key={col.key} col={col} count={grouped[col.key].length}>
            {grouped[col.key].map(task => (
              <Card
                key={task.uuid}
                task={task}
                column={col.key}
                pending={pending[task.uuid]}
                contribution={evalFor(task.uuid)}
                draggable={isDraggable(task)}
                canAct={canActOn(task)}
                isMobile={isMobile}
                onOpen={() => router.push(`/tasks/${task.uuid}`)}
                onReEvaluate={() => runEvaluate(task.uuid)}
                onValidate={() => runValidate(task.uuid)}
                onOpenMenu={openMenu}
              />
            ))}
            {grouped[col.key].length === 0 && (
              <div className="flex h-20 items-center justify-center rounded-[14px] border border-dashed border-white/[0.05]">
                <p className="text-xs text-white/15">Empty</p>
              </div>
            )}
          </Column>
        ))}
      </div>

      <p className="mt-3 text-xs text-white/30">
        Drag a card right to take it, then to Done to trigger the evaluation.
      </p>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardShell task={activeTask} dragging /> : null}
      </DragOverlay>

      {menu && (() => {
        const task = parents.find(t => t.uuid === menu.taskId);
        if (!task) return null;
        return (
          <ActionMenu
            x={menu.x}
            y={menu.y}
            busy={!!pending[menu.taskId]}
            onClose={() => setMenu(null)}
            onReEvaluate={() => { setMenu(null); runEvaluate(menu.taskId); }}
            onValidate={() => { setMenu(null); runValidate(menu.taskId); }}
          />
        );
      })()}
    </DndContext>
  );
}

// ─── Column (droppable) ───────────────────────────────────────────────────────

function Column({
  col, count, children,
}: {
  col: { key: ColKey; label: string; dot: string };
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="min-w-[80vw] shrink-0 snap-center space-y-3 md:min-w-0 md:shrink">
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
        <span className="text-xs font-semibold text-white/50">{col.label}</span>
        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/30">{count}</span>
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
  task, column, pending, contribution, draggable, canAct, isMobile,
  onOpen, onReEvaluate, onValidate, onOpenMenu,
}: {
  task: BoardTask;
  column: ColKey;
  pending?: Pending;
  contribution?: BoardContribution;
  draggable: boolean;
  canAct: boolean;
  isMobile: boolean;
  onOpen: () => void;
  onReEvaluate: () => void;
  onValidate: () => void;
  onOpenMenu: (taskId: string, x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.uuid, disabled: !draggable });

  const busy = !!pending;
  const isValidated = task.status === 'done';
  const isPendingValidation = column === 'done' && !isValidated && (!!contribution || pending === 'evaluating');
  const score = contribution?.evaluation?.globalScore;

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
      className={`select-none rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 transition-all
        ${isDragging ? 'opacity-40' : 'hover:border-white/12 hover:bg-white/[0.05]'}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{ touchAction: draggable ? 'none' : undefined }}
    >
      <CardShell task={task} score={isValidated ? score : undefined} />

      {/* Footer states */}
      {pending === 'assigning' && <LoadingLine label="Starting…" />}
      {pending === 'evaluating' && <LoadingLine label="Evaluating…" />}
      {pending === 'validating' && <LoadingLine label="Validating…" />}

      {!busy && isValidated && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Validated{typeof score === 'number' ? ` · ${Math.round(score)}` : ''}
        </div>
      )}

      {!busy && isPendingValidation && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2">
          <span className="rounded-full bg-brandCP/15 px-2.5 py-0.5 text-[11px] font-semibold text-brandCP">
            Score {typeof score === 'number' ? Math.round(score) : '–'}
          </span>
          <span className="text-[11px] text-white/30">to validate</span>

          {canAct && (
            isMobile ? (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenMenu(task.uuid, e.clientX, e.clientY); }}
                className="ml-auto rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                aria-label="Task actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onReEvaluate(); }}
                  className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white/80"
                >
                  <RotateCw className="h-3 w-3" /> Re-evaluate
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onValidate(); }}
                  className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-semibold text-green-400 transition-colors hover:bg-green-500/25"
                >
                  <Check className="h-3 w-3" /> Validate
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// The visual shell, reused by the drag overlay.
function CardShell({ task, score, dragging }: { task: BoardTask; score?: number; dragging?: boolean }) {
  return (
    <div className={dragging ? 'w-[280px] max-w-[80vw] rounded-xl border border-brandCP/30 bg-backgroundDark px-3.5 py-3 shadow-2xl' : ''}>
      <p className="text-sm font-medium leading-snug text-white">{task.title}</p>
      {task.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-white/35">{task.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {task.type === 'concurrent' && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">concurrent</span>
        )}
        {typeof score === 'number' && (
          <span className="rounded-full bg-brandCP/10 px-2 py-0.5 text-[10px] font-semibold text-brandCP">{Math.round(score)}</span>
        )}
        {task.assignees.length > 0 && (
          <div className="ml-auto flex -space-x-2">
            {task.assignees.slice(0, 3).map(a => (
              <div key={a.id} className="overflow-hidden rounded-full" style={{ boxShadow: '0 0 0 1.5px var(--background)' }}>
                <InitialsAvatar name={a.fullName} size={20} avatarUrl={a.avatarUrl} />
              </div>
            ))}
          </div>
        )}
      </div>
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

// ─── Mobile action popup ──────────────────────────────────────────────────────

function ActionMenu({
  x, y, busy, onClose, onReEvaluate, onValidate,
}: {
  x: number; y: number; busy: boolean;
  onClose: () => void; onReEvaluate: () => void; onValidate: () => void;
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
      className="w-48 rounded-xl border border-white/10 bg-backgroundDark p-1.5 shadow-2xl"
    >
      <button
        disabled={busy}
        onClick={onReEvaluate}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
      >
        <RotateCw className="h-4 w-4 shrink-0 text-white/40" />
        Re-evaluate
      </button>
      <button
        disabled={busy}
        onClick={onValidate}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-green-400 transition-colors hover:bg-green-500/[0.1] hover:text-green-300 disabled:opacity-40"
      >
        <Check className="h-4 w-4 shrink-0 text-green-400/70" />
        Validate
      </button>
    </div>
  );
}
