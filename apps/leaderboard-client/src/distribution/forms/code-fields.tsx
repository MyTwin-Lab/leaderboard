'use client';

import { ListTodo, Plus, Trash2 } from 'lucide-react';
import { GitHubIcon as Github } from '@/components/ui/GitHubIcon';
import { CodeRewardRulesEditor } from '@/components/admin/CodeRewardRulesEditor';
import { ChallengeTasksEditor } from '@/components/admin/ChallengeTasksEditor';
import { Field, INPUT_CLASS, LockedValue } from '@/components/admin/challengeFormFields';
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
            <div className="v-choices">
              {WORKSPACE_OPTIONS.map(opt => {
                const active = state.workspaceMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ workspaceMode: opt.value })}
                    className="v-choice"
                    data-on={active ? 'true' : 'false'}
                  >
                    <div className="v-choice-text">
                      <p className="v-choice-name">{opt.label}</p>
                      <p className="v-choice-hint">{opt.desc}</p>
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
        <div className="v-field">
          <p className="v-label">
            <ListTodo />
            Template tasks
            <span className="v-badge">{state.pendingTasks.length}</span>
          </p>
          <p className="v-help" data-size="xs">
            Copied to each contributor&apos;s personal board when they join. Saved once the challenge is created.
          </p>

          {state.pendingTasks.length === 0 ? (
            <p className="v-alert" data-tone="info">
              No template task yet. Add the first one below.
            </p>
          ) : (
            <div className="v-rows">
              {state.pendingTasks.map(task => (
                <div key={task.id} className="v-row">
                  <span className="v-row-title">{task.title}</span>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="v-btn-icon"
                    data-tone="danger"
                    aria-label="Remove task"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="v-section">
            <input
              type="text"
              value={state.pendingTaskTitle}
              onChange={e => onChange({ pendingTaskTitle: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              placeholder="New template task title…"
              className={INPUT_CLASS}
            />
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={addTask}
                disabled={!state.pendingTaskTitle.trim()}
                className="v-btn v-btn-sm"
              >
                <Plus />
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub repo: creation only, shared-repo mode only. */}
      {ctx.mode === 'create' && state.workspaceMode === 'provided_repo' && (
        <Field icon={<Github className="h-3.5 w-3.5" />} label="GitHub Repository" hint="Optional - can be set later">
          <input
            type="url"
            value={state.githubRepo}
            onChange={e => onChange({ githubRepo: e.target.value })}
            placeholder="https://github.com/owner/repo"
            className={INPUT_CLASS}
          />
        </Field>
      )}
    </>
  );
}
