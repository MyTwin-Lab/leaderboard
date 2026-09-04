'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Trophy, CalendarDays, AlignLeft, Map, Loader2,
  CheckCircle2, ChevronDown, Plus, Code2, BrainCircuit, Pencil, Lock, ShieldCheck, Cpu, Package,
  ListTodo, Trash2, FileText, Eye,
} from 'lucide-react';
import { GitHubIcon as Github } from '@/components/ui/GitHubIcon';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { Toggle } from '@/components/ui/Toggle';
import { MlRewardRulesEditor } from '@/components/admin/MlRewardRulesEditor';
import { CodeRewardRulesEditor } from '@/components/admin/CodeRewardRulesEditor';
import { ChallengeTasksEditor } from '@/components/admin/ChallengeTasksEditor';
import { ChallengeSlackSignalsEditor } from '@/components/admin/ChallengeSlackSignalsEditor';
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
import { flushTemplateTasks } from './templateTasksFlush';
import { flushBrief } from './briefFlush';
import { Markdown } from '@/components/ui/Markdown';
import { BRIEF_TEMPLATE, findBrief } from '@/lib/challengeBrief';
import {
  DEFAULT_ML_REWARD_RULES,
  parseMlRewardRules,
  type MlRewardRules,
} from '../../../../../packages/database-service/domain/mlRewardRules';
import {
  DEFAULT_CODE_REWARD_RULES,
  parseCodeRewardRules,
  type CodeRewardRules,
} from '../../../../../packages/database-service/domain/codeRewardRules';

interface Project {
  id: string;
  name: string;
}

/** An existing challenge being edited, as returned by GET /api/challenges/:id. */
export interface EditableChallenge {
  uuid: string;
  title: string;
  status: string;
  type: string;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  description?: string | null;
  roadmap?: string | null;
  contribution_points_reward: number;
  project_id: string;
  reward_rules?: MlRewardRules | CodeRewardRules | null;
  source_challenge_id?: string | null;
  cp_per_validation?: number | null;
  compute_enabled?: boolean | null;
  workspace_mode?: 'provided_repo' | 'own_repo' | null;
}

interface CreateChallengeDrawerProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  onCreated: (challengeId: string) => void;
  /**
   * Present = edit mode. The project, the reward pool and the repo are locked:
   * they define the challenge's shape and its budget, and contributors are
   * already racing against both.
   */
  challenge?: EditableChallenge;
}

/** Date inputs need YYYY-MM-DD; the API hands back ISO strings or Dates. */
const toDateInput = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toISOString().split('T')[0] : '';

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft',     dot: 'bg-white/25',   ring: 'ring-white/15'     },
  { value: 'active',    label: 'Active',    dot: 'bg-brandCP',    ring: 'ring-brandCP/30'   },
  { value: 'completed', label: 'Completed', dot: 'bg-green-500',  ring: 'ring-green-500/30' },
  { value: 'archived',  label: 'Archived',  dot: 'bg-white/10',   ring: 'ring-white/10'     },
];

// Helper for muted foreground color at a given opacity (0–1)
function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

export function CreateChallengeDrawer({ open, onClose, projects, onCreated, challenge }: CreateChallengeDrawerProps) {
  const isEdit = !!challenge;

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [status, setStatus] = useState('draft');
  const [type, setType] = useState<'code' | 'ml' | 'validation'>('code');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cp, setCp] = useState(100);
  const [description, setDescription] = useState('');
  const [roadmap, setRoadmap] = useState('');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<'provided_repo' | 'own_repo'>('provided_repo');
  const [rewardRules, setRewardRules] = useState<MlRewardRules>(DEFAULT_ML_REWARD_RULES);
  const [codeRules, setCodeRules] = useState<CodeRewardRules>(DEFAULT_CODE_REWARD_RULES);
  const [computeEnabled, setComputeEnabled] = useState(false);
  const [apiPackagingEnabled, setApiPackagingEnabled] = useState(true);
  const [sourceChallengeId, setSourceChallengeId] = useState('');
  const [cpPerValidation, setCpPerValidation] = useState(5);
  const [requiredValidations, setRequiredValidations] = useState(3);
  const [mlChallenges, setMlChallenges] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Template tasks, buffered locally until the challenge exists (create mode
  // only — edit mode uses ChallengeTasksEditor, which hits /api/tasks directly).
  // `id` is a local-only key (never sent to the API) so removing a row doesn't
  // rely on its position in the array.
  const [pendingTasks, setPendingTasks] = useState<{ id: string; title: string }[]>([]);
  const [pendingTaskTitle, setPendingTaskTitle] = useState('');
  const nextPendingTaskId = useRef(0);

  // Brief — le document Markdown affiché à un contributeur connecté qui n'a
  // pas encore rejoint le challenge. Bufferisé comme les template tasks en
  // création ; en édition il est chargé depuis les documents du challenge.
  // `existingBriefId` sert au cas "brief vidé" : il faut alors supprimer le
  // document, sinon la page continuerait d'afficher l'ancien texte.
  const [brief, setBrief] = useState('');
  const [existingBriefId, setExistingBriefId] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [briefPreview, setBriefPreview] = useState(false);

  // Set only when the challenge saved but one or more template tasks failed
  // to flush — the submit button turns into an explicit "Continue" the admin
  // must click, so the failure banner isn't wiped by an auto-navigate.
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);

  // Fires on the false → true transition only. Callers pass a freshly spread
  // `challenge` object, so keying this on its identity would refill the form —
  // and wipe whatever is being typed — on every parent re-render.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    setSuccess(false);
    setError('');
    setPendingChallengeId(null);
    setTimeout(() => titleRef.current?.focus(), 80);

    if (challenge) {
      setTitle(challenge.title);
      setProjectId(challenge.project_id);
      setStatus(challenge.status);
      setType(challenge.type === 'ml' ? 'ml' : challenge.type === 'validation' ? 'validation' : 'code');
      setStartDate(toDateInput(challenge.start_date));
      setEndDate(toDateInput(challenge.end_date));
      setCp(challenge.contribution_points_reward);
      setDescription(challenge.description ?? '');
      setRoadmap(challenge.roadmap ?? '');
      setShowRoadmap(!!challenge.roadmap);
      setWorkspaceMode(challenge.workspace_mode ?? 'provided_repo');
      const parsedCodeRules = parseCodeRewardRules(challenge.reward_rules);
      if (parsedCodeRules) {
        setCodeRules(parsedCodeRules);
      } else {
        setRewardRules(parseMlRewardRules(challenge.reward_rules) ?? DEFAULT_ML_REWARD_RULES);
      }
      setSourceChallengeId(challenge.source_challenge_id ?? '');
      setCpPerValidation(challenge.cp_per_validation ?? 5);
      setComputeEnabled(challenge.compute_enabled ?? false);
    }
  }, [open, challenge]);

  // Le brief vit dans les documents du challenge, pas dans sa ligne : en
  // édition il faut aller le chercher. Silencieux en cas d'échec — le tiroir
  // reste utilisable pour tout le reste, le brief s'affiche simplement vide.
  useEffect(() => {
    if (!open || !challenge) return;
    let cancelled = false;
    fetch(`/api/challenges/${challenge.uuid}/documents`)
      .then(r => r.ok ? r.json() : [])
      .then((docs: { uuid: string; filename: string; content: string }[]) => {
        if (cancelled) return;
        const found = findBrief(Array.isArray(docs) ? docs : []);
        setBrief(found?.content ?? '');
        setExistingBriefId(found?.uuid ?? null);
        setShowBrief(!!found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, challenge]);

  // Only needed to populate the source-challenge picker when creating a new
  // validation challenge — editing never touches this field (locked).
  useEffect(() => {
    if (!open || isEdit) return;
    fetch('/api/challenges')
      .then(r => r.ok ? r.json() : [])
      .then((all: any[]) => setMlChallenges(
        (Array.isArray(all) ? all : []).filter(c => c.type === 'ml').map(c => ({ id: c.uuid, title: c.title }))
      ))
      .catch(() => {});
  }, [open, isEdit]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const resetForm = () => {
    setTitle('');
    setProjectId(projects[0]?.id ?? '');
    setStatus('draft');
    setType('code');
    setStartDate('');
    setEndDate('');
    setCp(100);
    setDescription('');
    setRoadmap('');
    setShowRoadmap(false);
    setGithubRepo('');
    setWorkspaceMode('provided_repo');
    setRewardRules(DEFAULT_ML_REWARD_RULES);
    setCodeRules(DEFAULT_CODE_REWARD_RULES);
    setSourceChallengeId('');
    setCpPerValidation(5);
    setRequiredValidations(3);
    setComputeEnabled(false);
    setApiPackagingEnabled(true);
    setPendingTasks([]);
    setPendingTaskTitle('');
    setPendingChallengeId(null);
    setBrief('');
    setExistingBriefId(null);
    setShowBrief(false);
    setBriefPreview(false);
  };

  const addPendingTask = () => {
    const t = pendingTaskTitle.trim();
    if (!t) return;
    setPendingTasks(prev => [...prev, { id: String(nextPendingTaskId.current++), title: t }]);
    setPendingTaskTitle('');
  };

  const removePendingTask = (id: string) => {
    setPendingTasks(prev => prev.filter(t => t.id !== id));
  };

  /** Admin has read the partial-failure banner and clicked Continue. */
  const handleAcknowledgeFailure = () => {
    const id = pendingChallengeId;
    if (!id) return;
    resetForm();
    onCreated(id);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !projectId) {
      setError('Title and project are required.');
      return;
    }
    // Dates are optional, but an ordering that makes no sense still is one.
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }
    if (type === 'validation' && !isEdit && !sourceChallengeId) {
      setError('Pick the ML challenge this validation challenge tests.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const shared = {
        title: title.trim(),
        status,
        type,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || undefined,
        roadmap: roadmap.trim() || undefined,
        // Without rules an ML/code challenge awards nothing — the service has
        // nothing to score against.
        reward_rules: type === 'ml' ? rewardRules : type === 'code' ? codeRules : null,
        compute_enabled: type === 'ml' ? computeEnabled : false,
      };

      // Editing never touches the project, the pool, the repo, or (for
      // validation challenges) the source challenge / CP rate: they define the
      // challenge's shape and budget, and contributors/validators are already
      // racing against them. Omitting them means the API cannot change them.
      const res = await fetch(
        isEdit ? `/api/challenges/${challenge!.uuid}` : '/api/challenges',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? shared
              : {
                  ...shared,
                  project_id: projectId,
                  contribution_points_reward: cp,
                  workspace_mode: type === 'code' ? workspaceMode : undefined,
                  github_repo: type === 'code' && workspaceMode === 'provided_repo' && githubRepo.trim() ? githubRepo.trim() : undefined,
                  source_challenge_id: type === 'validation' ? sourceChallengeId : undefined,
                  cp_per_validation: type === 'validation' ? cpPerValidation : undefined,
                  required_validations: type === 'validation' ? requiredValidations : undefined,
                  api_packaging_enabled: type === 'ml' ? apiPackagingEnabled : undefined,
                }
          ),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const newChallengeId = data.uuid ?? data.id;

        const targetId: string | null = newChallengeId ?? challenge?.uuid ?? null;

        // Create mode + code challenge: flush the buffered template tasks now
        // that the challenge exists. Sequential, and non-fatal — the challenge
        // itself already saved, so a task failure shouldn't block the flow.
        let failedTasks = 0;
        if (!isEdit && type === 'code' && targetId && pendingTasks.length > 0) {
          failedTasks = (await flushTemplateTasks(targetId, pendingTasks)).failed;
        }

        // Le brief est un document : même contrainte que les template tasks
        // en création (pas d'uuid avant), même traitement de l'échec.
        let briefFailed = false;
        if (targetId && (brief.trim() || existingBriefId)) {
          briefFailed = !(await flushBrief(targetId, brief, existingBriefId)).ok;
        }

        setSuccess(true);

        const problems: string[] = [];
        if (failedTasks > 0) {
          problems.push(`${failedTasks} template task${failedTasks > 1 ? 's' : ''} failed to save`);
        }
        if (briefFailed) problems.push('the brief failed to save');

        if (problems.length > 0) {
          // The challenge saved fine, but silently auto-navigating away (the
          // normal success path) would carry the admin off before they ever
          // see this. Hold here — no resetForm/onCreated/onClose — until they
          // click Continue in the footer.
          setError(`Challenge ${isEdit ? 'updated' : 'created'}, but ${problems.join(' and ')} — fix ${problems.length > 1 ? 'them' : 'it'} from the edit drawer.`);
          setPendingChallengeId(targetId);
        } else {
          setTimeout(() => {
            if (!isEdit) resetForm();
            onCreated(newChallengeId ?? challenge!.uuid);
            onClose();
          }, 900);
        }
      } else {
        const d = await res.json();
        setError(d.error || `Failed to ${isEdit ? 'update' : 'create'} challenge`);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }));

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandCP/15">
              {isEdit
                ? <Pencil className="h-3.5 w-3.5 text-brandCP" />
                : <Plus className="h-4 w-4 text-brandCP" />}
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {isEdit ? 'Edit challenge' : 'New challenge'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            style={{ color: fgAt(0.3) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Challenge title…"
              className="w-full bg-transparent text-xl font-bold focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <div className="h-px bg-white/[0.06] transition-all focus-within:bg-brandCP/30" />
          </div>

          {/* ── Type ── */}
          {/* Locked on edit: the type decides which repos are created, and they
              only get created once, at creation. */}
          <Field label="Type">
            <div className="flex gap-2">
              {([
                { value: 'code',       label: 'Code',       icon: Code2,        desc: 'Tasks, Kanban, GitHub' },
                { value: 'ml',         label: 'ML',         icon: BrainCircuit, desc: 'Dataset, Model, API' },
                { value: 'validation', label: 'Validation', icon: ShieldCheck,  desc: 'Test a submitted API live' },
              ] as const).map(opt => {
                const Icon = opt.icon;
                const active = type === opt.value;
                if (isEdit && !active) return null;
                return (
                  <button
                    key={opt.value}
                    onClick={() => !isEdit && setType(opt.value)}
                    disabled={isEdit}
                    className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      active
                        ? 'border-brandCP/40 bg-brandCP/10 ring-1 ring-brandCP/20'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                    } ${isEdit ? 'cursor-default' : ''}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brandCP' : ''}`} style={active ? undefined : { color: fgAt(0.3) }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: active ? 'var(--foreground)' : fgAt(0.5) }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: fgAt(0.3) }}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ── Project ── */}
          <Field icon={<ChevronDown className="h-3.5 w-3.5" />} label="Project">
            {isEdit ? (
              <LockedValue text={projects.find(p => p.id === projectId)?.name ?? '—'} />
            ) : (
              <SelectDropdown
                options={projectOptions}
                value={projectId}
                onChange={setProjectId}
              />
            )}
          </Field>

          {/* ── Status ── */}
          <Field label="Status">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    status === opt.value
                      ? `border-white/20 bg-white/[0.08] ring-1 ${opt.ring}`
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                  style={{ color: status === opt.value ? 'var(--foreground)' : fgAt(0.4) }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Dates ── */}
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Timeline">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>Start</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
              <span className="mt-5" style={{ color: fgAt(0.2) }}>→</span>
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>End</p>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)', colorScheme: 'auto' }}
                />
              </div>
            </div>
          </Field>

          {/* ── CP Reward ── */}
          {/* Locked on edit: contributors are already racing against this pool. */}
          <Field icon={<Trophy className="h-3.5 w-3.5" />} label="CP Reward">
            <div className="flex items-center gap-4">
              {!isEdit && (
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={cp}
                  onChange={e => setCp(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
              )}
              <div className="flex items-baseline gap-1.5 animate-fade-up">
                <span className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{cp.toLocaleString()}</span>
                <span className="text-sm font-semibold text-brandCP">CP</span>
              </div>
            </div>
          </Field>

          {/* ── Code: workspace mode ── */}
          {/* Locked on edit: it decides which repos exist and how contributors
              submit — it only makes sense to fix at creation. */}
          {type === 'code' && (
            <Field label="Workspace mode">
              {isEdit ? (
                <LockedValue
                  text={workspaceMode === 'own_repo'
                    ? 'Own repo — each contributor submits their repo URL'
                    : 'Shared repo — one personal branch per contributor'}
                />
              ) : (
                <div className="flex gap-2">
                  {([
                    { value: 'provided_repo', label: 'Shared repo', desc: 'One personal branch per contributor' },
                    { value: 'own_repo',      label: 'Own repo',    desc: 'Each contributor submits their repo URL' },
                  ] as const).map(opt => {
                    const active = workspaceMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setWorkspaceMode(opt.value)}
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

          {/* ── Code reward rules ── */}
          {type === 'code' && (
            <CodeRewardRulesEditor
              value={codeRules}
              pool={cp}
              onChange={setCodeRules}
            />
          )}

          {/* ── ML reward rules ── */}
          {type === 'ml' && (
            <MlRewardRulesEditor
              value={rewardRules}
              pool={cp}
              onChange={setRewardRules}
              dense
            />
          )}

          {/* ── ML: GPU compute toggle ── */}
          {type === 'ml' && (
            <Field icon={<Cpu className="h-3.5 w-3.5" />} label="GPU compute power">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs" style={{ color: fgAt(0.4) }}>
                  Lets contributors request a Scaleway instance on this challenge
                </p>
                <Toggle enabled={computeEnabled} onChange={setComputeEnabled} />
              </div>
            </Field>
          )}

          {/* ── ML: API Packaging toggle (creation only — decides whether the repo/step exists) ── */}
          {type === 'ml' && !isEdit && (
            <Field icon={<Package className="h-3.5 w-3.5" />} label="API Packaging step">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs" style={{ color: fgAt(0.4) }}>
                  Adds a 3rd API Packaging step on top of Dataset and Model
                </p>
                <Toggle enabled={apiPackagingEnabled} onChange={setApiPackagingEnabled} />
              </div>
            </Field>
          )}

          {/* ── Validation: source challenge (creation only, locked after) ── */}
          {type === 'validation' && (
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Source ML challenge">
              {isEdit ? (
                <LockedValue text={mlChallenges.find(c => c.id === sourceChallengeId)?.title ?? 'ML challenge'} />
              ) : (
                <>
                  <SelectDropdown
                    options={mlChallenges.map(c => ({ value: c.id, label: c.title }))}
                    value={sourceChallengeId}
                    onChange={setSourceChallengeId}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: fgAt(0.25) }}>
                    Only ML challenges without a validation challenge yet will actually save — the API rejects duplicates.
                  </p>
                </>
              )}
            </Field>
          )}

          {/* ── Validation: CP per validation (locked after creation) ── */}
          {type === 'validation' && (
            <Field icon={<Trophy className="h-3.5 w-3.5" />} label="CP per validation">
              {isEdit ? (
                <LockedValue text={`${cpPerValidation} CP`} />
              ) : (
                <input
                  type="number"
                  min={1}
                  value={cpPerValidation}
                  onChange={e => setCpPerValidation(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
              )}
            </Field>
          )}

          {/* ── Validation: required validations (locked after creation) ── */}
          {type === 'validation' && (
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Required validations">
              {isEdit ? (
                <LockedValue text={`${requiredValidations} validators must agree`} />
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    min={1}
                    step={2}
                    value={requiredValidations}
                    onChange={e => {
                      const n = parseInt(e.target.value) || 1;
                      setRequiredValidations(n % 2 === 0 ? n + 1 : n);
                    }}
                    className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                    style={{ color: 'var(--foreground)' }}
                  />
                  <p className="text-[11px]" style={{ color: fgAt(0.25) }}>
                    Must be odd — majority wins once this many validators have voted.
                  </p>
                </div>
              )}
            </Field>
          )}

          {/* ── Description ── */}
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this challenge about?"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] resize-none leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            />
          </Field>

          {/* ── Brief — Markdown, enregistré comme document `brief.md` ──
              Affiché à un contributeur connecté qui n'a pas encore rejoint le
              challenge, à la place des KPI et de l'espace de travail. En
              création il est bufferisé ici puis flushé, comme les tasks. ── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowBrief(v => !v)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: fgAt(0.35) }}
            >
              <FileText className="h-3.5 w-3.5" />
              {showBrief ? 'Hide brief' : brief.trim() ? 'Edit brief' : 'Add brief (optional)'}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showBrief ? 'rotate-180' : ''}`} />
            </button>

            {showBrief && (
              <div className="space-y-2 animate-fade-up">
                <p className="text-xs" style={{ color: fgAt(0.3) }}>
                  Context, objectives and expected result, in Markdown. Shown before the workspace
                  to contributors who have not joined yet, and kept in the challenge documents as
                  <code className="mx-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[11px]">brief.md</code>
                  afterwards.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBriefPreview(v => !v)}
                    disabled={!brief.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] transition-colors hover:border-white/20 disabled:opacity-40"
                    style={{ color: fgAt(0.45) }}
                  >
                    {briefPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {briefPreview ? 'Write' : 'Preview'}
                  </button>
                  {!brief.trim() && (
                    <button
                      onClick={() => setBrief(BRIEF_TEMPLATE)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] transition-colors hover:border-brandCP/30 hover:text-brandCP/70"
                      style={{ color: fgAt(0.45) }}
                    >
                      <Plus className="h-3 w-3" />
                      Start from the template
                    </button>
                  )}
                </div>

                {briefPreview ? (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                    <Markdown source={brief} variant="prose" />
                  </div>
                ) : (
                  <textarea
                    value={brief}
                    onChange={e => setBrief(e.target.value)}
                    placeholder={'## Context\n\n…'}
                    rows={14}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs leading-relaxed focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                    style={{ color: 'var(--foreground)' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Tasks (code, edit) — independent CRUD via the tasks API ── */}
          {type === 'code' && isEdit && (
            <ChallengeTasksEditor challengeId={challenge!.uuid} open={open} />
          )}

          {/* ── Tasks (code, create) — buffered locally, flushed to the tasks
              API once the challenge exists (no challenge uuid yet to CRUD against) ── */}
          {type === 'code' && !isEdit && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
                <ListTodo className="h-3.5 w-3.5" />
                Template tasks
                <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
                  {pendingTasks.length}
                </span>
              </p>
              <p className="-mt-2 text-xs" style={{ color: fgAt(0.3) }}>
                Copied to each contributor&apos;s personal board when they join. Saved once the challenge is created.
              </p>

              {pendingTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
                  No template task yet. Add the first one below.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>
                        {task.title}
                      </span>
                      <button
                        onClick={() => removePendingTask(task.id)}
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
                  value={pendingTaskTitle}
                  onChange={e => setPendingTaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPendingTask(); } }}
                  placeholder="New template task title…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
                <div className="flex items-center justify-end">
                  <button
                    onClick={addPendingTask}
                    disabled={!pendingTaskTitle.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Slack discussion signals (edit only, both types) — independent CRUD ── */}
          {isEdit && (
            <ChallengeSlackSignalsEditor challengeId={challenge!.uuid} open={open} />
          )}

          {/* ── Validation targets (edit only) — independent CRUD ── */}
          {type === 'validation' && isEdit && (
            <>
              <ValidationTargetsEditor challengeId={challenge!.uuid} open={open} />
              <div className="mt-3">
                <ValidationRewardsPanel challengeId={challenge!.uuid} open={open} />
              </div>
            </>
          )}

          {/* ── GitHub repo (code only, creation only, provided_repo mode only) ── */}
          {type === 'code' && !isEdit && workspaceMode === 'provided_repo' && (
            <Field icon={<Github className="h-3.5 w-3.5" />} label="GitHub Repository">
              <input
                type="url"
                value={githubRepo}
                onChange={e => setGithubRepo(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                style={{ color: 'var(--foreground)' }}
              />
              <p className="text-[11px]" style={{ color: fgAt(0.25) }}>Optional — can be set later</p>
            </Field>
          )}

          {/* ── Roadmap (optional) ── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowRoadmap(v => !v)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: fgAt(0.35) }}
            >
              <Map className="h-3.5 w-3.5" />
              {showRoadmap ? 'Hide roadmap' : 'Add roadmap (optional)'}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showRoadmap ? 'rotate-180' : ''}`} />
            </button>
            {showRoadmap && (
              <textarea
                value={roadmap}
                onChange={e => setRoadmap(e.target.value)}
                placeholder="Roadmap, milestones, links…"
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] resize-none leading-relaxed animate-fade-up"
                style={{ color: 'var(--foreground)' }}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400 animate-slide-in">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-sm transition-colors"
            style={{ color: fgAt(0.35) }}
          >
            Cancel
          </button>

          <button
            onClick={pendingChallengeId ? handleAcknowledgeFailure : handleSubmit}
            disabled={saving || (success && !pendingChallengeId)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
              ${success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-brandCP/20 text-brandCP hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)]'
              }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {success && <CheckCircle2 className="h-4 w-4" />}
            {pendingChallengeId
              ? 'Continue'
              : isEdit
                ? (success ? 'Saved!' : saving ? 'Saving…' : 'Save changes')
                : (success ? 'Created!' : saving ? 'Creating…' : 'Create challenge')}
          </button>
        </div>
      </div>
    </>
  );
}

/** A value shown but not editable, styled to read as deliberate, not broken. */
function LockedValue({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm"
      style={{ color: fgAt(0.5) }}
    >
      <Lock className="h-3 w-3 shrink-0" style={{ color: fgAt(0.25) }} />
      {text}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}
