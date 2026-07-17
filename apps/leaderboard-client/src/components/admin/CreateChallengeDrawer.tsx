'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Trophy, CalendarDays, AlignLeft, Map, Loader2,
  CheckCircle2, ChevronDown, Plus, Code2, BrainCircuit, Pencil, Lock,
} from 'lucide-react';
import { GitHubIcon as Github } from '@/components/ui/GitHubIcon';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { MlRewardRulesEditor } from '@/components/admin/MlRewardRulesEditor';
import {
  DEFAULT_ML_REWARD_RULES,
  type MlRewardRules,
} from '../../../../../packages/database-service/domain/mlRewardRules';

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
  reward_rules?: MlRewardRules | null;
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
  const [type, setType] = useState<'code' | 'ml'>('code');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cp, setCp] = useState(100);
  const [description, setDescription] = useState('');
  const [roadmap, setRoadmap] = useState('');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [rewardRules, setRewardRules] = useState<MlRewardRules>(DEFAULT_ML_REWARD_RULES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

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
    setTimeout(() => titleRef.current?.focus(), 80);

    if (challenge) {
      setTitle(challenge.title);
      setProjectId(challenge.project_id);
      setStatus(challenge.status);
      setType(challenge.type === 'ml' ? 'ml' : 'code');
      setStartDate(toDateInput(challenge.start_date));
      setEndDate(toDateInput(challenge.end_date));
      setCp(challenge.contribution_points_reward);
      setDescription(challenge.description ?? '');
      setRoadmap(challenge.roadmap ?? '');
      setShowRoadmap(!!challenge.roadmap);
      setRewardRules(challenge.reward_rules ?? DEFAULT_ML_REWARD_RULES);
    }
  }, [open, challenge]);

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
    setRewardRules(DEFAULT_ML_REWARD_RULES);
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
        // Without rules an ML challenge awards nothing — the service has
        // nothing to score against.
        reward_rules: type === 'ml' ? rewardRules : null,
      };

      // Editing never touches the project, the pool or the repo: they are the
      // challenge's shape and budget, and contributors are already racing
      // against both. Omitting them means the API cannot change them either.
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
                  github_repo: type === 'code' && githubRepo.trim() ? githubRepo.trim() : undefined,
                }
          ),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSuccess(true);
        setTimeout(() => {
          if (!isEdit) resetForm();
          onCreated(data.uuid ?? data.id ?? challenge!.uuid);
          onClose();
        }, 900);
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
                { value: 'code', label: 'Code', icon: Code2, desc: 'Tasks, Kanban, GitHub' },
                { value: 'ml',   label: 'ML',   icon: BrainCircuit, desc: 'Dataset, Model, API' },
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

          {/* ── ML reward rules ── */}
          {type === 'ml' && (
            <MlRewardRulesEditor
              value={rewardRules}
              pool={cp}
              onChange={setRewardRules}
              dense
            />
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

          {/* ── GitHub repo (code only, creation only) ── */}
          {type === 'code' && !isEdit && (
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
            onClick={handleSubmit}
            disabled={saving || success}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
              ${success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-brandCP/20 text-brandCP hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)]'
              }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {success && <CheckCircle2 className="h-4 w-4" />}
            {isEdit
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
