'use client';

import { useState, useEffect } from 'react';
import {
  Database, BrainCircuit, Package, CheckCircle2,
  ExternalLink, Users, ChevronRight, Loader2, AlertCircle, Coins,
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
  workspace_meta: { userUrls?: Record<string, string>; userEndpoints?: Record<string, string>; [key: string]: unknown };
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
    hint: 'Scored by the evaluator. Reusing someone else\'s dataset earns you nothing here — but costs you nothing to build either.',
  },
  model: {
    label: 'Kaggle model',
    placeholder: 'https://www.kaggle.com/models/...',
    optional: false,
    hint: 'Required. Your metric is read from the model card and drives half of the model reward.',
  },
  model_code: {
    label: 'GitHub repository',
    placeholder: 'https://github.com/your-org/your-model',
    optional: true,
    hint: 'Optional. Unlocks the other half of the model reward — the evaluator scores your preprocessing, train split, and so on.',
  },
  api: {
    label: 'GitHub repository',
    placeholder: 'https://github.com/your-org/your-api',
    optional: false,
    hint: 'Scored by the evaluator as code.',
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
      // A challenge with no reward rules yet still renders — the pool banner
      // simply stays hidden rather than blocking the flow.
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

  const steps = STEP_CONFIG.map((cfg, i) => ({
    ...cfg,
    repos: stepRepos[cfg.key],
    done: isStepComplete(stepRepos[cfg.key], currentUserId),
  }));

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Pool remainder + metric to beat ── */}
      {pool && pool.pool > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className={pool.metric && pool.metric.points.length > 0 ? 'min-w-0 sm:max-w-[50%] sm:flex-1' : 'min-w-0 flex-1'}>
            <PoolBanner pool={pool} />
          </div>
          {pool.metric && pool.metric.points.length > 0 && (
            <div className="min-w-0 sm:flex-1">
              <MlMetricTimeline {...pool.metric} />
            </div>
          )}
        </div>
      )}

      {/* ── Stepper header ── */}
      <div className="flex items-center">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === i;
          const isDone = step.done;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <button
                onClick={() => setActiveStep(i)}
                className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 focus-visible:outline-none
                  ${isDone
                    ? 'border-green-500 bg-green-500/15'
                    : isActive
                      ? 'border-brandCP bg-brandCP/15 shadow-[0_0_16px_rgba(10,247,193,0.2)]'
                      : 'border-white/15 bg-white/[0.03] hover:border-white/30'
                  }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
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
  step: typeof STEP_CONFIG[number] & { repos: MLRepo[]; done: boolean };
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
        {step.done && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Submitted
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

// ─── Pool remainder ───────────────────────────────────────────────────────────

/**
 * Points are awarded live from a finite pool, in arrival order. Showing what is
 * left is the only way a contributor can tell whether it is still worth racing.
 */
function PoolBanner({ pool }: { pool: PoolState }) {
  const claimedPct = pool.pool > 0 ? Math.min(100, (pool.distributed / pool.pool) * 100) : 0;
  const empty = pool.remaining <= 0;

  return (
    <div className="h-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <Coins className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-brandCP/60" />
          <span className={`text-sm font-semibold ${empty ? 'text-white/40' : 'text-brandCP'}`}>
            {pool.remaining.toLocaleString()} CP
          </span>
          <span className="text-xs text-white/35">
            {empty ? 'left — the pool is empty' : 'left to claim'}
          </span>
        </div>
        <span className="text-xs text-white/25">
          {pool.distributed.toLocaleString()} / {pool.pool.toLocaleString()} awarded
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${empty ? 'bg-white/20' : 'bg-brandCP/60'}`}
          style={{ width: `${claimedPct}%` }}
        />
      </div>

      {empty && (
        <p className="text-xs text-white/30">
          Later submissions still get evaluated, but there are no points left to award.
        </p>
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
  onSaved,
}: {
  repo: MLRepo;
  challengeId: string;
  currentUserId: string | null;
  showCommunityPicker?: boolean;
  onSaved: () => void;
}) {
  const myUrl = getUserUrl(repo, currentUserId);
  const myEndpoint = repo.role === 'api' && currentUserId
    ? repo.workspace_meta?.userEndpoints?.[currentUserId]
    : undefined;
  const community = getCommunityUrls(repo, currentUserId);
  const meta = repo.role ? ROLE_META[repo.role] : null;

  const [urlInput, setUrlInput] = useState(myUrl ?? '');
  const [endpointInput, setEndpointInput] = useState(myEndpoint ?? '');
  const [saving, setSaving] = useState(false);
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [error, setError] = useState('');
  const [showCommunity, setShowCommunity] = useState(false);

  // Keep input in sync after refresh
  useEffect(() => { setUrlInput(myUrl ?? ''); }, [myUrl]);
  useEffect(() => { setEndpointInput(myEndpoint ?? ''); }, [myEndpoint]);

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

  const handleSubmitEndpoint = async () => {
    const url = endpointInput.trim();
    if (!url) return;
    setSavingEndpoint(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.repo_id, live_endpoint_url: url }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save endpoint');
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingEndpoint(false);
    }
  };

  const handleSelectCommunity = async (url: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.repo_id, workspace_url: url }),
      });
      if (res.ok) {
        setShowCommunity(false);
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
          <p className="text-xs text-white/35">{meta.hint}</p>
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
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
        />
        <button
          onClick={handleSubmit}
          disabled={saving || !urlInput.trim() || urlInput.trim() === myUrl}
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

      {/* Deployed endpoint — API packaging step only, requires the GitHub repo already submitted */}
      {repo.role === 'api' && myUrl && (
        <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-xs font-medium text-white/70">Deployed API endpoint (optional)</p>
          <p className="text-xs text-white/35">
            If you&apos;ve deployed your packaged API somewhere reachable, share the URL here so it can be
            tested from a validation challenge.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={endpointInput}
              onChange={e => setEndpointInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmitEndpoint()}
              placeholder="https://your-model.example.com/predict"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
            />
            <button
              onClick={handleSubmitEndpoint}
              disabled={savingEndpoint || !endpointInput.trim() || endpointInput.trim() === myEndpoint}
              className="shrink-0 rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingEndpoint ? <Loader2 className="h-4 w-4 animate-spin" /> : myEndpoint ? 'Update' : 'Save'}
            </button>
          </div>
          {myEndpoint && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
              <span className="text-xs text-green-400 truncate max-w-xs">{myEndpoint}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 animate-slide-in">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Community URLs — only shown on dataset step */}
      {showCommunityPicker && community.length > 0 && (
        <div>
          <button
            onClick={() => setShowCommunity(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            {showCommunity ? 'Hide' : 'Or pick from community'} ({community.length})
          </button>

          {showCommunity && (
            <div className="mt-2 space-y-1 animate-slide-in">
              {community.map(({ userId, url }, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectCommunity(url)}
                  disabled={saving}
                  className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-brandCP/20 hover:bg-brandCP/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/50">
                    {userId.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-xs text-white/50 group-hover:text-white/70 transition-colors">
                    {url}
                  </span>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brandCP/50" />
                  ) : (
                    <span className="shrink-0 rounded-md bg-brandCP/10 px-2 py-0.5 text-[10px] font-semibold text-brandCP/60 opacity-0 transition-opacity group-hover:opacity-100">
                      Use
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
