'use client';

import { useState } from 'react';
import { Loader2, GitBranch, Rocket, CheckCircle2, XCircle, ExternalLink, Users } from 'lucide-react';
import { ContributorTaskBoard, type BoardTask } from '@/components/contributor/ContributorTaskBoard';
import { trackOnboardingStep } from '@/lib/onboarding-track';

export interface CodeParticipation {
  user_id: string;
  workspace_provider?: 'github' | 'external';
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: 'pending' | 'ready' | 'failed';
}

export interface ProjectContribution {
  uuid: string;
  evaluation?: { globalScore?: number } | null;
  reward: number;
  evaluation_status?: string;
}

export function CodeChallengePanel({
  challengeId, workspaceMode, myTasks, templateTasks, myParticipation, myProjectContribution, isMember, onReload,
}: {
  challengeId: string;
  workspaceMode: 'provided_repo' | 'own_repo';
  myTasks: BoardTask[];
  templateTasks: BoardTask[];
  myParticipation: CodeParticipation | null;
  myProjectContribution: ProjectContribution | null;
  isMember: boolean;
  onReload: () => Promise<void> | void;
}) {
  const [joining, setJoining] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [repoUrl, setRepoUrl] = useState(myParticipation?.workspace_url ?? '');
  const [error, setError] = useState('');

  const join = async () => {
    setJoining(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to join'); return; }
      await onReload();
    } catch { setError('Network error'); }
    finally { setJoining(false); }
  };

  const saveRepoUrl = async () => {
    setError('');
    const res = await fetch(`/api/challenges/${challengeId}/workspace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Invalid repo URL'); return; }
    await onReload();
  };

  const launchEvaluation = async () => {
    setLaunching(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/project-evaluation`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Cannot start evaluation'); return; }
      trackOnboardingStep('validated_task');
      await onReload();
    } catch { setError('Network error'); }
    finally { setLaunching(false); }
  };

  // ── Non-membre : teaser + bouton rejoindre ──
  if (!isMember) {
    return (
      <div className="space-y-4">
        {templateTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Program</p>
            {templateTasks.filter(t => !t.parent_task_id).map(t => (
              <div key={t.uuid} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-white/35">{t.description}</p>}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={join}
          disabled={joining}
          className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-6 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/30 disabled:opacity-60"
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Join the challenge
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Membre ──
  const parents = myTasks.filter(t => !t.parent_task_id);
  const allDone = parents.length > 0 && parents.every(t => t.status === 'done')
    && myTasks.every(t => t.status === 'done');
  const workspaceReady = myParticipation?.workspace_provider === 'external'
    ? !!myParticipation?.workspace_url
    : myParticipation?.workspace_status === 'ready';
  const evalStatus = myProjectContribution?.evaluation_status;
  const running = evalStatus === 'running' || evalStatus === 'pending';
  const score = myProjectContribution?.evaluation?.globalScore;

  const disabledReason = !workspaceReady
    ? (workspaceMode === 'own_repo' ? 'Add your repository URL first' : 'Your personal branch is not ready yet')
    : parents.length === 0 ? 'Create at least one task'
    : !allDone ? 'Finish every task on your board'
    : running ? 'Evaluation in progress…'
    : null;

  return (
    <div className="space-y-5">
      {/* Workspace */}
      <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        {workspaceMode === 'own_repo' ? (
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 text-white/30" />
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/your-repo (public)"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brandCP/40 focus:outline-none"
            />
            <button onClick={saveRepoUrl} className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.1]">
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-white/30" />
            {myParticipation?.workspace_status === 'ready' && myParticipation.workspace_url ? (
              <a href={myParticipation.workspace_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-brandCP hover:underline">
                {myParticipation.workspace_ref?.replace('refs/heads/', '')} <ExternalLink className="h-3 w-3" />
              </a>
            ) : myParticipation?.workspace_status === 'failed' ? (
              <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3.5 w-3.5" /> Branch provisioning failed</span>
            ) : (
              <span className="flex items-center gap-1 text-white/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Provisioning your branch…</span>
            )}
          </div>
        )}
      </div>

      {/* Board perso */}
      <ContributorTaskBoard challengeId={challengeId} tasks={myTasks} onReload={onReload} />

      {/* Évaluation globale */}
      <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={launchEvaluation}
            disabled={!!disabledReason || launching}
            className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-5 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running || launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {running ? 'Evaluating…' : evalStatus === 'done' ? 'Re-evaluate my project' : 'Launch evaluation'}
          </button>
          {disabledReason && !running && <span className="text-xs text-white/30">{disabledReason}</span>}
        </div>

        {evalStatus === 'done' && typeof score === 'number' && (
          <p className="flex items-center gap-2 text-sm text-white/70">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Score {(Math.min(10, (score / 9) * 10)).toFixed(1)}/10 · {myProjectContribution!.reward} CP earned
          </p>
        )}
        {evalStatus === 'failed' && (
          <p className="flex items-center gap-2 text-xs text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Evaluation failed — check your repository and try again.
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
