'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import {
  ArrowLeft, CheckCircle2, Circle, ExternalLink,
  GitBranch, BarChart2, Users, ChevronRight,
} from 'lucide-react';

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
    avatar_url?: string;
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

// Distinct error class so the query's error message can carry the 404 vs
// generic-failure distinction the page used to derive from `res.status`.
class TaskDetailsError extends Error {
  constructor(public status: number) { super(`Task details request failed with ${status}`); }
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const taskId = params.id as string;

  const [evaluating, setEvaluating] = useState(false);
  const [completing, setCompleting] = useState(false);

  const detailsQuery = useQuery({
    queryKey: ['task-details', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/details`);
      if (!res.ok) throw new TaskDetailsError(res.status);
      return res.json() as Promise<TaskDetails>;
    },
    enabled: !!taskId,
    retry: false,
  });

  const data = detailsQuery.data ?? null;
  const loading = detailsQuery.isLoading;
  const error = detailsQuery.isError
    ? ((detailsQuery.error as TaskDetailsError)?.status === 404 ? 'Task not found' : 'Failed to load task')
    : null;

  const refetchDetails = () => queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/evaluate`, { method: 'POST' });
      if (res.ok) {
        await refetchDetails();
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
        await refetchDetails();
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6 pt-2">
        <div className="h-4 w-24 rounded-full bg-white/8" />
        <div className="space-y-3">
          <div className="h-3 w-20 rounded-full bg-white/8" />
          <div className="h-8 w-2/3 rounded-xl bg-white/10" />
          <div className="h-3 w-full max-w-lg rounded-full bg-white/6" />
        </div>
        <div className="flex gap-6">
          <div className="h-7 w-24 rounded-full bg-white/8" />
          <div className="h-7 w-20 rounded-full bg-white/8" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5" />)}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/5" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-white/40 text-sm">
        {error || 'Task not found.'}
      </div>
    );
  }

  const { task, challenge, assignees, workspaces, subTasks, contribution } = data;
  const isDone = task.status === 'done';

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">

      {/* ── Back ── */}
      <button
        onClick={() => router.back()}
        className="group mb-6 flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        {challenge ? challenge.title : 'Back'}
      </button>

      {/* ── Hero ── */}
      <div className="mb-10">
        {/* Status row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isDone ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isDone ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {isDone ? 'Done' : 'To do'}
          </span>
          <span className="text-white/20">·</span>
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-white/40 capitalize">
            {task.type}
          </span>
          {challenge && (
            <>
              <span className="text-white/20">·</span>
              <Link
                href={`/challenges/${challenge.uuid}`}
                className="text-xs text-white/40 hover:text-brandCP transition-colors"
              >
                {challenge.title}
              </Link>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {task.title}
        </h1>

        {/* Description */}
        {task.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-white/50">
            {task.description}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap items-center gap-5">
          {challenge?.contribution_points_reward != null && (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-white">
                  {challenge.contribution_points_reward.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-brandCP">CP</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
            </>
          )}
          <span className="text-xs text-white/30">
            {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">

        {/* ── Left column: Assignees + Sub-tasks ── */}
        <div className="space-y-8">

          {/* Assignees */}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <Users className="h-3.5 w-3.5" />
              Assignees
              {assignees.length > 0 && (
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">
                  {assignees.length}
                </span>
              )}
            </h2>
            {assignees.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-8 text-center">
                <Users className="h-6 w-6 text-white/15" />
                <p className="text-xs text-white/25">Unassigned</p>
              </div>
            ) : (
              <div className="space-y-1">
                {assignees.map(a => (
                  <div key={a.uuid} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                    <InitialsAvatar name={a.full_name} size={30} avatarUrl={a.avatar_url} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{a.full_name}</p>
                      {a.github_username && (
                        <p className="text-xs text-white/35 truncate">@{a.github_username}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-tasks */}
          {subTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sub-tasks
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">
                  {subTasks.filter(s => s.status === 'done').length}/{subTasks.length}
                </span>
              </h2>
              <div className="space-y-1">
                {subTasks.map((st, idx) => (
                  <Link
                    key={st.uuid}
                    href={`/tasks/${st.uuid}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                      st.status === 'done' ? 'bg-green-500' : 'bg-white/25'
                    }`} />
                    <span className={`flex-1 truncate text-sm ${
                      st.status === 'done' ? 'text-white/35 line-through decoration-white/20' : 'text-white'
                    }`}>
                      {st.title}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/0 transition-all group-hover:text-white/25" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Workspaces + Evaluation ── */}
        <div className="space-y-8">

          {/* Workspaces */}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <GitBranch className="h-3.5 w-3.5" />
              Workspaces
              {workspaces.length > 0 && (
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">
                  {workspaces.length}
                </span>
              )}
            </h2>
            {workspaces.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-10 text-center">
                <GitBranch className="h-7 w-7 text-white/15" />
                <p className="text-xs text-white/25">No workspaces configured</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workspaces.map((ws, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {ws.repo_external_id || ws.repo_title}
                      </p>
                      {ws.workspace_ref && (
                        <p className="mt-0.5 font-mono text-xs text-white/35">
                          {ws.workspace_ref.replace(/^refs\/heads\//, '')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {ws.workspace_status && <WorkspaceStatusBadge status={ws.workspace_status} />}
                      {ws.workspace_url && (
                        <a
                          href={ws.workspace_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25 hover:shadow-[0_0_12px_rgba(10,247,193,0.15)]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluation */}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <BarChart2 className="h-3.5 w-3.5" />
              Evaluation
            </h2>

            {contribution?.evaluation ? (
              <div className="space-y-4">
                {/* Score banner */}
                <div className="flex items-center gap-4 rounded-xl border border-brandCP/15 bg-brandCP/[0.04] px-4 py-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brandCP/15">
                    <span className="text-2xl font-bold text-brandCP">
                      {Math.round(contribution.evaluation.globalScore ?? 0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Global Score</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {contribution.evaluation.scores?.length ?? 0} criteria · {contribution.reward.toLocaleString()} CP earned
                    </p>
                  </div>
                </div>

                {/* Criteria */}
                {contribution.evaluation.scores && contribution.evaluation.scores.length > 0 && (
                  <div className="space-y-2">
                    {contribution.evaluation.scores.map((s, i) => (
                      <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white">{s.criterion}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[10px] text-white/25">×{s.weight}</span>
                            <span className="rounded-full bg-brandCP/15 px-2.5 py-0.5 text-xs font-bold text-brandCP">
                              {s.score}/10
                            </span>
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP transition-[width] duration-700 ease-out"
                            style={{ width: `${s.score * 10}%` }}
                          />
                        </div>
                        {s.comment && (
                          <p className="mt-2.5 text-xs italic leading-relaxed text-white/40">{s.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-white/25">
                  Evaluated {new Date(contribution.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-12 text-center">
                <BarChart2 className="h-7 w-7 text-white/15" />
                <p className="text-xs text-white/25">
                  {contribution ? 'No evaluation data yet' : 'No evaluation run yet'}
                </p>
              </div>
            )}

            {/* Actions */}
            {!isDone && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  className="rounded-lg bg-brandCP/15 px-4 py-2 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25 hover:shadow-[0_0_12px_rgba(10,247,193,0.1)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {evaluating ? 'Evaluating…' : contribution?.evaluation ? 'Re-evaluate' : 'Evaluate'}
                </button>
                {contribution?.evaluation && (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="rounded-lg bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 transition-all duration-200 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {completing ? 'Validating…' : 'Mark as done'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WorkspaceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready:   'bg-green-500/15 text-green-400',
    pending: 'bg-yellow-500/15 text-yellow-400',
    failed:  'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-white/8 text-white/40'}`}>
      {status}
    </span>
  );
}
