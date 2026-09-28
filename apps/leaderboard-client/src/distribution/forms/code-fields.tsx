'use client';

import { ListTodo, Plus, Trash2 } from 'lucide-react';
import { GitHubIcon as Github } from '@/components/ui/GitHubIcon';
import { CodeRewardRulesEditor } from '@/components/admin/CodeRewardRulesEditor';
import { ChallengeTasksEditor } from '@/components/admin/ChallengeTasksEditor';
import { Field, INPUT_CLASS, LockedValue, fgAt } from '@/components/admin/challengeFormFields';
import type { FlowFormSectionProps } from '@/lib/flowFormSlots';
import type { CodeFormState, WorkspaceMode } from './code';

const WORKSPACE_OPTIONS: { value: WorkspaceMode; label: string; desc: string }[] = [
  { value: 'provided_repo', label: 'Shared repo', desc: 'One personal branch per contributor' },
  { value: 'own_repo', label: 'Own repo', desc: 'Each contributor submits their repo URL' },
];

export function CodeFields({ state, onChange, ctx }: FlowFormSectionProps<CodeFormState>) {
  return (
    <>
      {/* Locked on edit: it decides which repos exist and how contributors
          submit — it only makes sense to fix at creation. Hidden on
          promotion: a code sandbox always becomes an `own_repo` challenge on
          its author's repository, and the route does not accept the field. */}
      {ctx.mode !== 'promotion' && (
        <Field label="Workspace mode">
          {ctx.mode === 'edit' ? (
            <LockedValue text={state.workspaceMode === 'own_repo'
              ? 'Own repo - each contributor submits their repo URL'
              : 'Shared repo - one personal branch per contributor'}
            />
          ) : (
            <div className="flex gap-2">
              {WORKSPACE_OPTIONS.map(opt => {
                const active = state.workspaceMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ workspaceMode: opt.value })}
                    className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      active
                        ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: active ? 'var(--foreground)' : fgAt(0.5) }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: fgAt(0.3) }}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}

      <CodeRewardRulesEditor
        value={state.codeRules}
        pool={ctx.pool}
        onChange={codeRules => onChange({ codeRules })}
      />
    </>
  );
}

export function CodeDetails({ state, onChange, ctx }: FlowFormSectionProps<CodeFormState>) {
  const addTask = () => {
    const title = state.pendingTaskTitle.trim();
    if (!title) return;
    onChange({
      pendingTasks: [...state.pendingTasks, { id: String(state.nextTaskId), title }],
      nextTaskId: state.nextTaskId + 1,
      pendingTaskTitle: '',
    });
  };

  const removeTask = (id: string) => {
    onChange({ pendingTasks: state.pendingTasks.filter(t => t.id !== id) });
  };

  return (
    <>
      {/* Edit: independent CRUD via the tasks API. Create and promotion:
          buffered locally, flushed once the challenge exists. */}
      {ctx.mode === 'edit' ? (
        <ChallengeTasksEditor challengeId={ctx.challenge!.uuid} open={ctx.open} />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
            <ListTodo className="h-3.5 w-3.5" />
            Template tasks
            <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
              {state.pendingTasks.length}
            </span>
          </p>
          <p className="-mt-2 text-xs" style={{ color: fgAt(0.3) }}>
            Copied to each contributor&apos;s personal board when they join. Saved once the challenge is created.
          </p>

          {state.pendingTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No template task yet. Add the first one below.
            </p>
          ) : (
            <div className="space-y-1.5">
              {state.pendingTasks.map(task => (
                <div key={task.id} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Remove task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <input
              type="text"
              value={state.pendingTaskTitle}
              onChange={e => onChange({ pendingTaskTitle: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              placeholder="New template task title…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="flex items-center justify-end">
              <button
                onClick={addTask}
                disabled={!state.pendingTaskTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub repo: creation only, shared-repo mode only. */}
      {ctx.mode === 'create' && state.workspaceMode === 'provided_repo' && (
        <Field icon={<Github className="h-3.5 w-3.5" />} label="GitHub Repository">
          <input
            type="url"
            value={state.githubRepo}
            onChange={e => onChange({ githubRepo: e.target.value })}
            placeholder="https://github.com/owner/repo"
            className={`w-full ${INPUT_CLASS}`}
            style={{ color: 'var(--foreground)' }}
          />
          <p className="text-[11px]" style={{ color: fgAt(0.25) }}>Optional - can be set later</p>
        </Field>
      )}
    </>
  );
}
