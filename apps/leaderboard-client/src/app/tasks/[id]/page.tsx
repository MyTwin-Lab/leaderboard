'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';

interface TaskDetails {
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
    workspace_meta?: Record<string, unknown>;
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
      const json = await res.json();
      setData(json);
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
        // Refresh details to show updated evaluation
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

  const { task, challenge, assignees, workspaces, subTasks, contribution } = data;

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
                      <div>
                        <p className="text-sm font-medium text-white">
                          {ws.repo_external_id || ws.repo_title}
                        </p>
                        {ws.workspace_ref && (
                          <p className="text-xs text-white/50">
                            Branch: <span className="font-mono text-brandCP">{ws.workspace_ref.replace(/^refs\/heads\//, '')}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ws.workspace_status && (
                        <WorkspaceStatusBadge status={ws.workspace_status} />
                      )}
                      {ws.workspace_url && (
                        <a
                          href={ws.workspace_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 transition"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

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

        <div className="mt-4 flex justify-center">
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
