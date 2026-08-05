'use client';

import { useState, useEffect } from 'react';
import {
  Database, BrainCircuit, Package, CheckCircle2,
  ExternalLink, Users, ChevronRight, Loader2, AlertCircle, Lock,
} from 'lucide-react';
import { ComputeRequestPanel } from './ComputeRequestPanel';
import { MlMetricTimeline } from './MlMetricTimeline';

// ─── Types ────────────────────────────────────────────────────────────────────

type MLRepoRole = 'dataset' | 'model' | 'model_code' | 'api';

interface MLRepo {
  repo_id: string;
  repo_type: 'kaggle_dataset' | 'kaggle_model' | 'github' | string;
  repo_external_id?: string;
  role: MLRepoRole | null;
  workspace_meta: {
    userUrls?: Record<string, string>;
    /** Dataset step only — the full set of datasets (own + community picks) a user has attached to their model build. */
    datasetUrls?: Record<string, string[]>;
    [key: string]: unknown;
  };
}

interface MLWorkspaceData {
  currentUserId: string | null;
  repos: MLRepo[];
}

interface StepRepos {
  dataset: MLRepo[];
  model: MLRepo[];
  api: MLRepo[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * The model step owns two repos — the Kaggle model and its optional GitHub —
 * so a repo's step comes from its explicit role, never from its type.
 */
function assignReposToSteps(repos: MLRepo[]): StepRepos {
  const byRole = (...roles: MLRepoRole[]) =>
    repos.filter(r => r.role && roles.includes(r.role));

  return {
    dataset: byRole('dataset'),
    model: byRole('model', 'model_code'),
    api: byRole('api'),
  };
}

function getUserUrl(repo: MLRepo, userId: string | null): string | undefined {
  if (!userId) return undefined;
  return repo.workspace_meta?.userUrls?.[userId];
}

function getCommunityUrls(repo: MLRepo, currentUserId: string | null): { userId: string; url: string }[] {
  const userUrls = repo.workspace_meta?.userUrls ?? {};
  return Object.entries(userUrls)
    .filter(([uid]) => uid !== currentUserId)
    .map(([userId, url]) => ({ userId, url }));
}

/**
 * Dataset step only — every dataset URL a user has attached to their model build
 * (their own + any community picks). Falls back to their single own URL when
 * `datasetUrls` hasn't been written yet (pre-multi-select submissions).
 */
function getMyDatasetUrls(repo: MLRepo, userId: string | null): string[] {
  if (!userId) return [];
  const fromSet = repo.workspace_meta?.datasetUrls?.[userId];
  if (fromSet) return fromSet;
  const own = repo.workspace_meta?.userUrls?.[userId];
  return own ? [own] : [];
}

/**
 * A step is done once every *required* repo has a URL. The model's GitHub is
 * optional — it unlocks the other half of the reward — so it must not gate the
 * step, and the mandatory Kaggle model must not be satisfied by it either.
 */
function isStepComplete(repos: MLRepo[], userId: string | null): boolean {
  if (!userId || repos.length === 0) return false;
  const required = repos.filter(r => r.role && !ROLE_META[r.role].optional);
  if (required.length === 0) return false;
  return required.every(r => !!getUserUrl(r, userId));
}

// ─── Role & step config ──────────────────────────────────────────────────────

/** What each repo slot asks of the contributor, and what it is worth. */
const ROLE_META: Record<MLRepoRole, {
  label: string;
  placeholder: string;
  optional: boolean;
  hint: string;
}> = {
  dataset: {
    label: 'Kaggle dataset',
    placeholder: 'https://www.kaggle.com/datasets/...',
    optional: false,
    hint: '',
  },
  model: {
    label: 'Kaggle model',
    placeholder: 'https://www.kaggle.com/models/...',
    optional: false,
    hint: '',
  },
  model_code: {
    label: 'GitHub repository',
    placeholder: 'https://github.com/your-org/your-model',
    optional: true,
    hint: '',
  },
  api: {
    label: 'GitHub repository',
    placeholder: 'https://github.com/your-org/your-api',
    optional: false,
    hint: '',
  },
};

const STEP_CONFIG = [
  {
    key: 'dataset' as const,
    label: 'Dataset',
    sublabel: 'Kaggle dataset',
    icon: Database,
    description: 'Share your Kaggle dataset or pick one already submitted by the community.',
  },
  {
    key: 'model' as const,
    label: 'Model',
    sublabel: 'Kaggle model + optional GitHub',
    icon: BrainCircuit,
    description: 'Publish your trained model on Kaggle, and link its GitHub repository to unlock the full reward.',
  },
  {
    key: 'api' as const,
    label: 'API Packaging',
    sublabel: 'GitHub repo only',
    icon: Package,
    description: 'Share the GitHub repository containing your packaged API.',
  },
] as const;

type StepKey = 'dataset' | 'model' | 'api';

// ─── Main component ───────────────────────────────────────────────────────────

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  metric: { name: string; baseline: number; points: number[] } | null;
  bestValue: number | null;
  thresholdReached: boolean;
}

export function MLChallengeFlow({ challengeId }: { challengeId: string }) {
  const [data, setData] = useState<MLWorkspaceData | null>(null);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => { fetchData(); }, [challengeId]);

  const fetchData = async () => {
    try {
      const [wsRes, poolRes] = await Promise.all([
        fetch(`/api/challenges/${challengeId}/ml-workspace`),
        fetch(`/api/challenges/${challengeId}/ml-rewards`),
      ]);
      if (wsRes.ok) setData(await wsRes.json());
      // A challenge with no reward rules yet still renders — the metric
      // timeline and threshold lock simply stay off rather than blocking the flow.
      if (poolRes.ok) setPool(await poolRes.json());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-full bg-white/8" />
              {i < 2 && <div className="h-px flex-1 bg-white/8" />}
            </div>
          ))}
        </div>
        <div className="h-48 rounded-xl bg-white/5 border border-white/[0.06]" />
      </div>
    );
  }

  if (!data) return null;

  const stepRepos = assignReposToSteps(data.repos);
  const { currentUserId } = data;

  // Once the metric hits the challenge's configured threshold, dataset/model
  // submissions close — only API packaging keeps taking new work.
  const steps = STEP_CONFIG.map((cfg, i) => ({
    ...cfg,
    repos: stepRepos[cfg.key],
    done: isStepComplete(stepRepos[cfg.key], currentUserId),
    locked: !!pool?.thresholdReached && (cfg.key === 'dataset' || cfg.key === 'model'),
  }));

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Metric to beat ── */}
      {pool?.metric && pool.metric.points.length > 0 && (
        <MlMetricTimeline {...pool.metric} />
      )}

      {/* ── Stepper header ── */}
      <div className="flex items-center">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === i;
          const isDone = step.done;
          const isLocked = step.locked && !isDone;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <button
                onClick={() => setActiveStep(i)}
                className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 focus-visible:outline-none
                  ${isDone
                    ? 'border-green-500 bg-green-500/15'
                    : isLocked
                      ? 'border-white/10 bg-white/[0.02]'
                      : isActive
                        ? 'border-brandCP bg-brandCP/15 shadow-[0_0_16px_rgba(10,247,193,0.2)]'
                        : 'border-white/15 bg-white/[0.03] hover:border-white/30'
                  }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : isLocked ? (
                  <Lock className="h-4 w-4 text-white/20" />
                ) : (
                  <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-brandCP' : 'text-white/30 group-hover:text-white/50'}`} />
                )}

                {/* Step label below */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                  <p className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-white' : isDone ? 'text-green-400' : 'text-white/25'}`}>
                    {step.label}
                  </p>
                </div>
              </button>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="relative mx-2 flex-1 h-px bg-white/[0.08]">
                  <div
                    className="absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP/20 transition-[width] duration-700 ease-out"
                    style={{ width: isDone ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spacer for labels */}
      <div className="h-3" />

      {/* ── Step content ── */}
      <div key={activeStep} className="animate-fade-up">
        <StepPanel
          step={steps[activeStep]}
          challengeId={challengeId}
          currentUserId={currentUserId}
          onSaved={fetchData}
          onNext={activeStep < steps.length - 1 ? () => setActiveStep(activeStep + 1) : undefined}
        />
      </div>

      {/* ── GPU compute request ── */}
      <ComputeRequestPanel challengeId={challengeId} />

    </div>
  );
}

// ─── Step panel ───────────────────────────────────────────────────────────────

function StepPanel({
  step,
  challengeId,
  currentUserId,
  onSaved,
  onNext,
}: {
  step: typeof STEP_CONFIG[number] & { repos: MLRepo[]; done: boolean; locked: boolean };
  challengeId: string;
  currentUserId: string | null;
  onSaved: () => void;
  onNext?: () => void;
}) {
  const Icon = step.icon;

  if (step.repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <Icon className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No {step.label.toLowerCase()} workspace configured for this challenge</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${step.done ? 'border-green-500/30 bg-green-500/10' : 'border-brandCP/20 bg-brandCP/8'}`}>
            <Icon className={`h-4 w-4 ${step.done ? 'text-green-400' : 'text-brandCP'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{step.label}</h3>
            <p className="text-xs text-white/35 mt-0.5">{step.sublabel}</p>
          </div>
        </div>
        {step.done ? (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Submitted
          </span>
        ) : step.locked && (
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/40">
            <Lock className="h-3 w-3" />
            Locked — threshold reached
          </span>
        )}
      </div>

      <p className="text-sm text-white/50">{step.description}</p>

      {/* One submission form per repo — the model step renders two */}
      {step.repos.map(repo => (
        <RepoSubmission
          key={repo.repo_id}
          repo={repo}
          challengeId={challengeId}
          currentUserId={currentUserId}
          showCommunityPicker={step.key === 'dataset'}
          locked={step.locked}
          onSaved={onSaved}
        />
      ))}

      {/* Next step CTA */}
      {onNext && step.done && (
        <div className="pt-1 flex justify-end">
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-4 py-2 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25"
          >
            Next step
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Per-repo submission form ─────────────────────────────────────────────────

function RepoSubmission({
  repo,
  challengeId,
  currentUserId,
  showCommunityPicker = false,
  locked = false,
  onSaved,
}: {
  repo: MLRepo;
  challengeId: string;
  currentUserId: string | null;
  showCommunityPicker?: boolean;
  locked?: boolean;
  onSaved: () => void;
}) {
  const myUrl = getUserUrl(repo, currentUserId);
  const community = getCommunityUrls(repo, currentUserId);
  const myDatasetUrls = getMyDatasetUrls(repo, currentUserId);
  const meta = repo.role ? ROLE_META[repo.role] : null;

  const [urlInput, setUrlInput] = useState(myUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Keep input in sync after refresh
  useEffect(() => { setUrlInput(myUrl ?? ''); }, [myUrl]);

  const handleSubmit = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.repo_id, workspace_url: url }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Dataset step only — toggles a community dataset in/out of the set used to
   * build a model. Does not touch `workspace_url` (that stays "my own dataset"),
   * so checking/unchecking a community pick never affects the dataset step's
   * own evaluation, only how a later model reward gets split.
   */
  const handleToggleCommunity = async (url: string) => {
    const next = myDatasetUrls.includes(url)
      ? myDatasetUrls.filter(u => u !== url)
      : [...myDatasetUrls, url];
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.repo_id, dataset_urls: next.length ? next : null }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">

      {/* What this slot is and what it is worth */}
      {meta && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/70">{meta.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              meta.optional
                ? 'bg-white/[0.06] text-white/40'
                : 'bg-brandCP/12 text-brandCP/80'
            }`}>
              {meta.optional ? 'Optional' : 'Required'}
            </span>
          </div>
          {meta.hint && <p className="text-xs text-white/35">{meta.hint}</p>}
        </div>
      )}

      {locked && (
        <div className="flex items-center gap-1.5 text-xs text-white/35">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Threshold reached — submissions are closed for this step.
        </div>
      )}

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={meta?.placeholder}
          disabled={locked}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={locked || saving || !urlInput.trim() || urlInput.trim() === myUrl}
          className="shrink-0 rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25 hover:shadow-[0_0_12px_rgba(10,247,193,0.15)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : myUrl ? 'Update' : 'Submit'}
        </button>
      </div>

      {/* Submitted URL confirmation */}
      {myUrl && (
        <div className="flex items-center gap-1.5 animate-slide-in">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
          <a
            href={myUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-400 underline hover:text-green-300 truncate max-w-xs flex items-center gap-1"
          >
            {myUrl}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 animate-slide-in">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Community datasets — only shown on dataset step, always open, multi-select */}
      {showCommunityPicker && community.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-white/35">
            <Users className="h-3.5 w-3.5" />
            Pick from community ({community.length})
          </div>

          <div className="mt-2 space-y-1 animate-slide-in">
            {community.map(({ userId, url }, i) => {
              const selected = myDatasetUrls.includes(url);
              return (
                <button
                  key={i}
                  onClick={() => handleToggleCommunity(url)}
                  disabled={saving || locked}
                  aria-pressed={selected}
                  className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-brandCP/40 bg-brandCP/[0.08]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-brandCP/20 hover:bg-brandCP/[0.04]'
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    selected ? 'bg-brandCP/20 text-brandCP' : 'bg-white/10 text-white/50'
                  }`}>
                    {userId.slice(0, 1).toUpperCase()}
                  </div>
                  <span className={`flex-1 truncate text-xs transition-colors ${
                    selected ? 'text-white/80' : 'text-white/50 group-hover:text-white/70'
                  }`}>
                    {url}
                  </span>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brandCP/50" />
                  ) : selected ? (
                    <span className="flex items-center gap-1 shrink-0 rounded-md bg-brandCP/15 px-2 py-0.5 text-[10px] font-semibold text-brandCP">
                      <CheckCircle2 className="h-3 w-3" />
                      Selected
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-brandCP/10 px-2 py-0.5 text-[10px] font-semibold text-brandCP/60 opacity-0 transition-opacity group-hover:opacity-100">
                      Use
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
