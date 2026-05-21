'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { HowToContribute } from '@/components/tasks/HowToContribute';
import { trackOnboardingStep } from '@/lib/onboarding-track';

interface TaskDetails {
  currentUserId: string | null;
  task: {
    uuid: string;
    challenge_id: string;
    parent_task_id?: string;
    title: string;
    description?: string;
    type: 'solo' | 'concurrent';
    status: 'todo' | 'done';
    created_at: string;
  };
  challenge: {
    uuid: string;
    title: string;
    status: string;
    completion: number;
    contribution_points_reward: number;
  } | null;
  assignees: {
    uuid: string;
    full_name: string;
    github_username: string;
  }[];
  workspaces: {
    repo_id: string;
    repo_title: string;
    repo_type: string;
    repo_external_id?: string;
    workspace_provider?: string;
    workspace_ref?: string;
    workspace_url?: string;
    workspace_status?: string;
    workspace_meta?: { userUrls?: Record<string, string>; [key: string]: unknown };
  }[];
  subTasks: {
    uuid: string;
    title: string;
    description?: string;
    type: 'solo' | 'concurrent';
    status: 'todo' | 'done';
    created_at: string;
  }[];
  contribution: {
    uuid: string;
    title: string;
    type: string;
    description?: string;
    evaluation?: {
      scores?: { criterion: string; score: number; weight: number; comment?: string }[];
      globalScore?: number;
    };
    reward: number;
    submitted_at: string;
  } | null;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [data, setData] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [kaggleUrls, setKaggleUrls] = useState<Record<string, string>>({});
  const [submittingKaggle, setSubmittingKaggle] = useState<Record<string, boolean>>({});
  const [kaggleErrors, setKaggleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDetails();
  }, [taskId]);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/details`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Task not found' : 'Failed to load task');
        return;
      }
      const json: TaskDetails = await res.json();
      setData(json);
      // Pre-fill Kaggle inputs with the current user's already-submitted URLs
      if (json.currentUserId) {
        const prefilled: Record<string, string> = {};
        for (const ws of json.workspaces) {
          const myUrl = ws.workspace_meta?.userUrls?.[json.currentUserId];
          if (myUrl) prefilled[ws.repo_id] = myUrl;
        }
        setKaggleUrls(prefilled);
      }
    } catch {
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/evaluate`, { method: 'POST' });
      if (res.ok) {
        await fetchDetails();
      } else {
        const err = await res.json();
        alert(err.error || 'Evaluation failed');
      }
    } catch {
      alert('Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
      if (res.ok) {
        trackOnboardingStep('validated_task');
        await fetchDetails();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to complete task');
      }
    } catch {
      alert('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const handleKaggleSubmit = async (repoId: string) => {
    const url = kaggleUrls[repoId]?.trim();
    if (!url) return;
    setSubmittingKaggle(prev => ({ ...prev, [repoId]: true }));
    setKaggleErrors(prev => ({ ...prev, [repoId]: '' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}/workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, workspace_url: url }),
      });
      if (res.ok) {
        await fetchDetails();
      } else {
        const err = await res.json();
        setKaggleErrors(prev => ({ ...prev, [repoId]: err.error || 'Failed to save URL' }));
      }
    } catch {
      setKaggleErrors(prev => ({ ...prev, [repoId]: 'Failed to save URL' }));
    } finally {
      setSubmittingKaggle(prev => ({ ...prev, [repoId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-white/10" />
          <div className="h-4 w-96 rounded bg-white/5" />
          <div className="h-32 rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <p className="text-white/60">{error || 'Task not found'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
        >
          Go back
        </button>
      </div>
    );
  }

  const { currentUserId, task, challenge, assignees, workspaces, subTasks, contribution } = data;

  return (
    <div className="mx-auto mt-4 max-w-3xl space-y-6 sm:mt-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center bg-white/10 rounded-xl px-3 py-2 gap-1.5 text-sm text-white/100 hover:bg-white/20 transition"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* Task info + Workspaces side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left — Task card */}
        <div className="rounded-lg bg-white/5 p-5 shadow-md shadow-black/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-base font-bold text-white sm:text-lg">{task.title}</h1>
              {challenge && (
                <Link
                  href={`/challenges/${challenge.uuid}`}
                  className="mt-1 inline-block text-sm text-brandCP hover:underline"
                >
                  {challenge.title}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge label={task.type} />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  task.status === 'done'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {task.status === 'done' ? 'Done' : 'To do'}
              </span>
              {workspaces[0]?.repo_type && (
                <HowToContribute
                  repoType={workspaces[0].repo_type as 'github' | 'kaggle_dataset' | 'kaggle_model'}
                  githubRepo={workspaces[0].repo_external_id ?? workspaces[0].repo_title}
                  branchSlug={workspaces[0].workspace_ref?.replace(/^refs\/heads\//, '')}
                />
              )}
            </div>
          </div>
          {task.description && (
            <p className="mt-2 text-sm leading-relaxed text-white/70">{task.description}</p>
          )}
        </div>

        {/* Right — Workspaces */}
        <Section title={`Workspaces (${workspaces.length})`}>
          {workspaces.length === 0 ? (
            <p className="text-sm text-white/40">No workspaces configured</p>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws, i) => (
                <div key={i} className="rounded-lg bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const userUrl = currentUserId ? ws.workspace_meta?.userUrls?.[currentUserId] : undefined;
                        const branchLabel = ws.workspace_ref
                          ? ws.workspace_ref.replace(/^refs\/heads\//, '')
                          : (userUrl && ws.repo_type === 'github')
                            ? (() => {
                                try {
                                  const parts = new URL(userUrl).pathname.split('/').filter(Boolean);
                                  const treeIdx = parts.indexOf('tree');
                                  return treeIdx !== -1 ? parts.slice(treeIdx + 1).join('/') : null;
                                } catch { return null; }
                              })()
                            : null;
                        return (
                          <div>
                            <p className="text-sm font-medium text-white">
                              {ws.repo_external_id || ws.repo_title}
                            </p>
                            {branchLabel && (
                              <p className="text-xs text-white/50">
                                Branch: <span className="font-mono text-brandCP">{branchLabel}</span>
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {ws.workspace_status && (
                        <WorkspaceStatusBadge status={ws.workspace_status} />
                      )}
                      {(() => {
                        const userUrl = currentUserId ? ws.workspace_meta?.userUrls?.[currentUserId] : undefined;
                        const openUrl = userUrl ?? ws.workspace_url;
                        return openUrl ? (
                          <a
                            href={openUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 transition"
                          >
                            Open
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Kaggle URL submission — one panel per Kaggle workspace, always visible */}
      {workspaces
        .filter(ws => ws.repo_type === 'kaggle_model' || ws.repo_type === 'kaggle_dataset')
        .map(ws => {
          const mySubmittedUrl = currentUserId ? ws.workspace_meta?.userUrls?.[currentUserId] : undefined;
          const isSubmitted = !!mySubmittedUrl;
          const label = ws.repo_type === 'kaggle_model' ? 'Kaggle Model' : 'Kaggle Dataset';
          return (
            <Section key={ws.repo_id} title={label}>
              <p className="mb-3 text-sm text-white/60">
                Paste the link to your {label.toLowerCase()} so it can be included in the evaluation.
                {task.type === 'concurrent' && (
                  <span className="ml-1 text-white/40">(Each contributor submits their own link.)</span>
                )}
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={kaggleUrls[ws.repo_id] ?? ''}
                  onChange={e => setKaggleUrls(prev => ({ ...prev, [ws.repo_id]: e.target.value }))}
                  placeholder={ws.repo_type === 'kaggle_model' ? 'https://www.kaggle.com/models/...' : 'https://www.kaggle.com/datasets/...'}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brandCP"
                />
                <button
                  onClick={() => handleKaggleSubmit(ws.repo_id)}
                  disabled={submittingKaggle[ws.repo_id] || !kaggleUrls[ws.repo_id]?.trim()}
                  className="rounded-xl bg-brandCP/10 px-4 py-2 text-sm font-semibold text-brandCP hover:bg-brandCP/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingKaggle[ws.repo_id] ? 'Saving...' : isSubmitted ? 'Update' : 'Submit'}
                </button>
              </div>
              {isSubmitted && !kaggleErrors[ws.repo_id] && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Submitted
                </p>
              )}
              {kaggleErrors[ws.repo_id] && (
                <p className="mt-2 text-xs text-red-400">{kaggleErrors[ws.repo_id]}</p>
              )}
            </Section>
          );
        })}

      {/* Evaluation */}
      <Section title="Evaluation">
        {contribution?.evaluation ? (
          <div className="space-y-4">
            {/* Global score */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brandCP/20">
                <span className="text-xl font-bold text-brandCP">
                  {Math.round(contribution.evaluation.globalScore ?? 0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Global Score</p>
                <p className="text-xs text-white/50">
                  Based on {contribution.evaluation.scores?.length ?? 0} criteria
                </p>
              </div>
            </div>

            {/* Detailed scores with AI comments */}
            {contribution.evaluation.scores && contribution.evaluation.scores.length > 0 && (
              <div className="space-y-3">
                {contribution.evaluation.scores.map((s, i) => (
                  <div key={i} className="rounded-lg bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{s.criterion}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">weight: {s.weight}</span>
                        <span className="rounded-full bg-brandCP/20 px-2.5 py-0.5 text-xs font-semibold text-brandCP">
                          {s.score}/10
                        </span>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-brandCP transition-all duration-500"
                        style={{ width: `${s.score*10}%` }}
                      />
                    </div>
                    {/* AI comment */}
                    {s.comment && (
                      <p className="mt-2 text-xs leading-relaxed text-white/60 italic">
                        {s.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-white/40">
              Last evaluated: {new Date(contribution.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-white/40 mb-4">
              {contribution ? 'No evaluation data yet' : 'No evaluation has been run for this task yet'}
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-center gap-3">
          {task.status !== 'done' && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="rounded-xl bg-brandCP/10 px-6 py-2 text-sm font-semibold text-brandCP hover:bg-brandCP/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {evaluating
                ? 'Evaluating...'
                : contribution?.evaluation
                  ? 'Re-evaluate'
                  : 'Evaluate'}
            </button>
          )}
          {contribution?.evaluation && task.status !== 'done' && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="rounded-xl bg-green-500/10 px-6 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {completing ? 'Validating...' : 'Mark as done'}
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

// --- Helper components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/5 p-5 shadow-md shadow-black/20">
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}


function WorkspaceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-white/10 text-white/50'}`}>
      {status}
    </span>
  );
}
