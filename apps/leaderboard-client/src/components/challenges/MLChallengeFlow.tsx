'use client';

import { useState, useEffect } from 'react';
import {
  Database, BrainCircuit, Package, CheckCircle2,
  ExternalLink, Users, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MLRepo {
  repo_id: string;
  repo_type: 'kaggle_dataset' | 'kaggle_model' | 'github' | string;
  repo_external_id?: string;
  workspace_meta: { userUrls?: Record<string, string>; [key: string]: unknown };
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

function assignReposToSteps(repos: MLRepo[]): StepRepos {
  const hasKaggleModel = repos.some(r => r.repo_type === 'kaggle_model');
  const githubRepos = repos.filter(r => r.repo_type === 'github');

  return {
    dataset: repos.filter(r => r.repo_type === 'kaggle_dataset'),
    model: [
      ...repos.filter(r => r.repo_type === 'kaggle_model'),
      // If no kaggle_model repo, first github repo is treated as the model repo
      ...(hasKaggleModel ? [] : githubRepos.slice(0, 1)),
    ],
    api: hasKaggleModel ? githubRepos : githubRepos.slice(1),
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

function isStepComplete(repos: MLRepo[], userId: string | null): boolean {
  if (!userId || repos.length === 0) return false;
  return repos.some(r => !!getUserUrl(r, userId));
}

// ─── Step config ─────────────────────────────────────────────────────────────

const STEP_CONFIG = [
  {
    key: 'dataset' as const,
    label: 'Dataset',
    sublabel: 'Kaggle dataset',
    icon: Database,
    description: 'Share your Kaggle dataset or pick one already submitted by the community.',
    allowKaggle: true,
    allowGithub: false,
    kagglePlaceholder: 'https://www.kaggle.com/datasets/...',
  },
  {
    key: 'model' as const,
    label: 'Model',
    sublabel: 'Kaggle model or GitHub',
    icon: BrainCircuit,
    description: 'Share your trained model via Kaggle or link your GitHub repository.',
    allowKaggle: true,
    allowGithub: true,
    kagglePlaceholder: 'https://www.kaggle.com/models/...',
    githubPlaceholder: 'https://github.com/your-org/your-model',
  },
  {
    key: 'api' as const,
    label: 'API Packaging',
    sublabel: 'GitHub repo only',
    icon: Package,
    description: 'Share the GitHub repository containing your packaged API.',
    allowKaggle: false,
    allowGithub: true,
    githubPlaceholder: 'https://github.com/your-org/your-api',
  },
] as const;

type StepKey = 'dataset' | 'model' | 'api';

// ─── Main component ───────────────────────────────────────────────────────────

export function MLChallengeFlow({ challengeId }: { challengeId: string }) {
  const [data, setData] = useState<MLWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => { fetchData(); }, [challengeId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`);
      if (res.ok) setData(await res.json());
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

      {/* One submission form per repo */}
      {step.repos.map(repo => (
        <RepoSubmission
          key={repo.repo_id}
          repo={repo}
          challengeId={challengeId}
          currentUserId={currentUserId}
          allowKaggle={step.allowKaggle}
          allowGithub={'allowGithub' in step ? step.allowGithub : false}
          showCommunityPicker={step.key === 'dataset'}
          kagglePlaceholder={'kagglePlaceholder' in step ? step.kagglePlaceholder : undefined}
          githubPlaceholder={'githubPlaceholder' in step ? step.githubPlaceholder : undefined}
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
  allowKaggle,
  allowGithub,
  showCommunityPicker = false,
  kagglePlaceholder,
  githubPlaceholder,
  onSaved,
}: {
  repo: MLRepo;
  challengeId: string;
  currentUserId: string | null;
  allowKaggle: boolean;
  allowGithub: boolean;
  showCommunityPicker?: boolean;
  kagglePlaceholder?: string;
  githubPlaceholder?: string;
  onSaved: () => void;
}) {
  const myUrl = getUserUrl(repo, currentUserId);
  const community = getCommunityUrls(repo, currentUserId);

  const [urlInput, setUrlInput] = useState(myUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCommunity, setShowCommunity] = useState(false);
  // For model step: toggle between kaggle and github
  const [mode, setMode] = useState<'kaggle' | 'github'>(
    allowKaggle ? 'kaggle' : 'github'
  );

  // Keep input in sync after refresh
  useEffect(() => { setUrlInput(myUrl ?? ''); }, [myUrl]);

  const placeholder = mode === 'github' ? githubPlaceholder : kagglePlaceholder;

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

      {/* Mode toggle (only when both kaggle & github allowed) */}
      {allowKaggle && allowGithub && (
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 w-fit">
          {(['kaggle', 'github'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                mode === m
                  ? 'bg-brandCP/20 text-brandCP'
                  : 'text-white/35 hover:text-white/60'
              }`}
            >
              {m === 'kaggle' ? 'Kaggle' : 'GitHub'}
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
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
