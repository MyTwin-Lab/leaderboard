'use client';

import { useState, useEffect } from 'react';
import { FormField, FormFooter, FormSection, inputClass, selectClass } from '@/components/ui/FormField';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus, Code2, BrainCircuit, ShieldCheck, Cpu, Package } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { MlRewardRulesEditor } from './MlRewardRulesEditor';
import { ValidationTargetsEditor } from './ValidationTargetsEditor';
import { ValidationRewardsPanel } from './ValidationRewardsPanel';
import { DEFAULT_ML_REWARD_RULES, parseMlRewardRules, type MlRewardRules } from '../../../../../packages/database-service/domain/mlRewardRules';
import type { Challenge, Project, Task } from '../../../../../packages/database-service/domain/entities';

interface ChallengeFormProps {
  challenge?: Challenge;
  projects: Project[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ChallengeForm({ challenge, projects, onSubmit, onCancel }: ChallengeFormProps) {
  const [formData, setFormData] = useState({
    title: challenge?.title ?? '',
    status: challenge?.status ?? 'draft',
    type: (challenge as any)?.type ?? 'code',
    start_date: challenge?.start_date ? new Date(challenge.start_date).toISOString().split('T')[0] : '',
    end_date: challenge?.end_date ? new Date(challenge.end_date).toISOString().split('T')[0] : '',
    description: challenge?.description ?? '',
    roadmap: challenge?.roadmap ?? '',
    contribution_points_reward: challenge?.contribution_points_reward ?? 0,
    project_id: challenge?.project_id ?? '',
  });

  const [rewardRules, setRewardRules] = useState<MlRewardRules>(
    parseMlRewardRules(challenge?.reward_rules) ?? DEFAULT_ML_REWARD_RULES
  );
  const [computeEnabled, setComputeEnabled] = useState((challenge as any)?.compute_enabled ?? false);
  const [apiPackagingEnabled, setApiPackagingEnabled] = useState(true);

  const [sourceChallengeId, setSourceChallengeId] = useState((challenge as any)?.source_challenge_id ?? '');
  const [cpPerValidation, setCpPerValidation] = useState((challenge as any)?.cp_per_validation ?? 5);
  const [requiredValidations, setRequiredValidations] = useState((challenge as any)?.required_validations ?? 3);
  const [mlChallenges, setMlChallenges] = useState<{ id: string; title: string }[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [challengeRepos, setChallengeRepos] = useState<
    { repo_id: string; repo_type: string; repo_external_id?: string; challenge_id: string }[]
  >([]);

  const confirm = useConfirm();

  useEffect(() => {
    if (challenge?.uuid) {
      fetchTasks();
      fetchChallengeRepos();
    }
  }, [challenge?.uuid]);

  // Only needed to populate the source-challenge picker when creating a new
  // validation challenge — editing never touches this field (locked).
  useEffect(() => {
    if (challenge?.uuid) return;
    fetch('/api/challenges')
      .then(res => res.ok ? res.json() : [])
      .then((all: any[]) => setMlChallenges(
        (Array.isArray(all) ? all : []).filter(c => c.type === 'ml').map(c => ({ id: c.uuid, title: c.title }))
      ))
      .catch(() => {});
  }, [challenge?.uuid]);

  const fetchTasks = async () => {
    if (!challenge?.uuid) return;
    try {
      const res = await fetch(`/api/tasks?challenge_id=${challenge.uuid}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    }
  };

  const fetchChallengeRepos = async () => {
    if (!challenge?.uuid) return;
    try {
      const res = await fetch(`/api/challenges/${challenge.uuid}/repos`);
      const data = await res.json();
      setChallengeRepos(Array.isArray(data) ? data : []);
    } catch {
      setChallengeRepos([]);
    }
  };

  const handleCreateTask = async (data: any) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) { await fetchTasks(); setShowTaskForm(false); }
    } catch { /* noop */ }
  };

  const handleUpdateTask = async (data: any) => {
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) { await fetchTasks(); setShowTaskForm(false); setEditingTask(undefined); }
    } catch { /* noop */ }
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchTasks();
    } catch { /* noop */ }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCancelTaskForm = () => {
    setShowTaskForm(false);
    setEditingTask(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Reward rules are meaningless on code challenges — send null so a type
    // switch does not leave stale ML rules behind on the record.
    // source_challenge_id / cp_per_validation are creation-only (locked after,
    // like the pool/project) — only sent when creating a new challenge.
    onSubmit({
      ...formData,
      reward_rules: formData.type === 'ml' ? rewardRules : null,
      compute_enabled: formData.type === 'ml' ? computeEnabled : false,
      ...(formData.type === 'validation' && !challenge?.uuid
        ? { source_challenge_id: sourceChallengeId, cp_per_validation: cpPerValidation, required_validations: requiredValidations }
        : {}),
      ...(formData.type === 'ml' && !challenge?.uuid
        ? { api_packaging_enabled: apiPackagingEnabled }
        : {}),
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({
        ...p,
        [field]: field === 'contribution_points_reward' ? parseInt(e.target.value) || 0 : e.target.value,
      }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {/* Section: Identité */}
      <FormSection title="General">
        <FormField label="Title" required>
          <input
            type="text"
            required
            value={formData.title}
            onChange={set('title')}
            className={inputClass}
            placeholder="Challenge title"
            autoFocus
          />
        </FormField>

        {/* Type picker */}
        <FormField label="Type">
          <div className="flex gap-2">
            {([
              { value: 'code',       label: 'Code',       icon: Code2,        desc: 'Tasks, Kanban, GitHub' },
              { value: 'ml',         label: 'ML',         icon: BrainCircuit, desc: 'Dataset, Model, API' },
              { value: 'validation', label: 'Validation', icon: ShieldCheck,  desc: 'Test a submitted API live' },
            ] as const).map(opt => {
              const Icon = opt.icon;
              const active = formData.type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: opt.value }))}
                  className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    active
                      ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brandCP' : 'text-white/30'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/50'}`}>{opt.label}</p>
                    <p className="text-[10px] text-white/30">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Status" required>
            <select required value={formData.status} onChange={set('status')} className={selectClass}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>

          <FormField label="Project" required>
            <select required value={formData.project_id} onChange={set('project_id')} className={selectClass}>
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.uuid} value={p.uuid}>{p.title}</option>
              ))}
            </select>
          </FormField>

          <FormField label="CP Reward" required>
            <input
              type="number"
              required
              min={0}
              value={formData.contribution_points_reward}
              onChange={set('contribution_points_reward')}
              className={inputClass}
              placeholder="0"
            />
          </FormField>
        </div>

        {formData.type === 'ml' && (
          <MlRewardRulesEditor
            value={rewardRules}
            pool={formData.contribution_points_reward}
            onChange={setRewardRules}
          />
        )}

        {formData.type === 'ml' && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Cpu className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">GPU compute power</p>
                <p className="text-xs text-white/35 mt-0.5">Lets contributors request a Scaleway instance on this challenge</p>
              </div>
            </div>
            <Toggle enabled={computeEnabled} onChange={setComputeEnabled} />
          </div>
        )}

        {formData.type === 'ml' && !challenge?.uuid && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">API Packaging step</p>
                <p className="text-xs text-white/35 mt-0.5">Adds a 3rd API Packaging step on top of Dataset and Model</p>
              </div>
            </div>
            <Toggle enabled={apiPackagingEnabled} onChange={setApiPackagingEnabled} />
          </div>
        )}

        {formData.type === 'validation' && (
          <FormField label="Source ML challenge" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {mlChallenges.find(c => c.id === sourceChallengeId)?.title ?? 'ML challenge (locked)'}
              </p>
            ) : (
              <select
                required
                value={sourceChallengeId}
                onChange={e => setSourceChallengeId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select an ML challenge</option>
                {mlChallenges.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
          </FormField>
        )}

        {formData.type === 'validation' && (
          <FormField label="CP per validation" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{cpPerValidation} CP</p>
            ) : (
              <input
                type="number"
                required
                min={1}
                value={cpPerValidation}
                onChange={e => setCpPerValidation(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
            )}
          </FormField>
        )}

        {formData.type === 'validation' && (
          <FormField label="Required validations" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{requiredValidations} validators must agree</p>
            ) : (
              <>
                <input
                  type="number"
                  required
                  min={1}
                  step={2}
                  value={requiredValidations}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 1;
                    setRequiredValidations(n % 2 === 0 ? n + 1 : n);
                  }}
                  className={inputClass}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Must be odd — a target resolves once this many validators have voted, majority wins.
                </p>
              </>
            )}
          </FormField>
        )}

        <FormField label="Description">
          <textarea
            rows={3}
            value={formData.description}
            onChange={set('description')}
            className={inputClass}
            placeholder="What is this challenge about?"
          />
        </FormField>
      </FormSection>

      {/* Section: Planning */}
      <FormSection title="Planning">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Start Date">
            <input
              type="date"
              value={formData.start_date}
              onChange={set('start_date')}
              className={inputClass}
            />
          </FormField>

          <FormField label="End Date">
            <input
              type="date"
              value={formData.end_date}
              onChange={set('end_date')}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="Roadmap">
          <textarea
            rows={4}
            value={formData.roadmap}
            onChange={set('roadmap')}
            className={inputClass}
            placeholder="Roadmap, milestones, objectives…"
          />
        </FormField>
      </FormSection>

      {/* Section: Validation targets — edit only */}
      {challenge?.uuid && formData.type === 'validation' && (
        <FormSection title="Validation targets">
          <ValidationTargetsEditor challengeId={challenge.uuid} open />
          <div className="mt-3">
            <ValidationRewardsPanel challengeId={challenge.uuid} open />
          </div>
        </FormSection>
      )}

      {/* Section: Tasks — seulement en mode édition */}
      {challenge?.uuid && (
        <FormSection title="Tasks">
          {showTaskForm ? (
            <TaskForm
              task={editingTask}
              challengeId={challenge.uuid}
              availableParentTasks={tasks.filter((t) => !t.parent_task_id)}
              availableRepos={challengeRepos}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onCancel={handleCancelTaskForm}
            />
          ) : (
            <>
              <TaskList tasks={tasks} onEdit={handleEditTask} onDelete={handleDeleteTask} />
              <button
                type="button"
                onClick={() => setShowTaskForm(true)}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-white/40 transition-colors hover:border-white/40 hover:text-white/60"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </>
          )}
        </FormSection>
      )}

      <FormFooter
        onCancel={onCancel}
        submitLabel={challenge ? 'Update Challenge' : 'Create Challenge'}
      />
    </form>
  );
}
