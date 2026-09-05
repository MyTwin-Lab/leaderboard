'use client';

import { useState } from 'react';
import { Loader2, GitBranch, Rocket, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { ContributorTaskBoard, type BoardTask } from '@/components/contributor/ContributorTaskBoard';
import { trackOnboardingStep } from '@/lib/onboarding-track';
import { useJoinChallenge } from '@/lib/useJoinChallenge';
import { JoinButton } from '@/components/challenges/JoinButton';

export interface CodeParticipation {
  user_id: string;
  /** Jeton d'invitation — publié uniquement sur sa propre participation. */
  group_id?: string;
  /** Porteur du board, publié pour tous : dit qui travaille avec qui. */
  group_owner_id?: string | null;
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
  const [launching, setLaunching] = useState(false);
  const [repoUrl, setRepoUrl] = useState(myParticipation?.workspace_url ?? '');
  const [error, setError] = useState('');

  const { join, joining, error: joinError } = useJoinChallenge(challengeId, onReload);

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
        <JoinButton onClick={join} joining={joining} />
        {joinError && <p className="text-xs text-red-400">{joinError}</p>}
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
      {/* Workspace — the branch we provisioned, or the contributor's own repo.
          One row: icon, what it is, where it points, and a status pill pushed
          to the far end. */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <GitBranch className="h-[15px] w-[15px] shrink-0 text-white/40" />
        {workspaceMode === 'own_repo' ? (
          <input
            type="url"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            // The mockup has no save button: the field commits on Enter and on
            // blur, so the URL is never left typed-but-unsaved.
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRepoUrl(); } }}
            onBlur={() => { if (repoUrl.trim() && repoUrl !== myParticipation?.workspace_url) saveRepoUrl(); }}
            placeholder="https://github.com/you/your-repo (public)"
            className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-brandCP/40 focus:outline-none"
          />
        ) : (
          <>
            <span className="text-xs text-white/45">Your branch</span>
            {myParticipation?.workspace_status === 'ready' && myParticipation.workspace_url ? (
              <>
                <a href={myParticipation.workspace_url} target="_blank" rel="noopener noreferrer"
                   className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-[13px] font-semibold text-brandCP hover:underline">
                  {myParticipation.workspace_ref?.replace('refs/heads/', '')}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <StatusPill tone="ready">Ready</StatusPill>
              </>
            ) : myParticipation?.workspace_status === 'failed' ? (
              <StatusPill tone="failed">Provisioning failed</StatusPill>
            ) : (
              <StatusPill tone="pending">
                <Loader2 className="h-3 w-3 animate-spin" /> Provisioning…
              </StatusPill>
            )}
          </>
        )}
      </div>

      {/* Board perso */}
      <ContributorTaskBoard challengeId={challengeId} tasks={myTasks} onReload={onReload} />

      {/* Evaluation — launch on the left, why it is locked next to it, and the
          score pushed to the far end once it has run. */}
      <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-4 py-4">
        <button
          onClick={launchEvaluation}
          disabled={!!disabledReason || launching}
          className="inline-flex items-center gap-2 rounded-full bg-brandCP/20 px-5 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running || launching ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Rocket className="h-[15px] w-[15px]" />}
          {running ? 'Evaluating…' : evalStatus === 'done' ? 'Re-evaluate my project' : 'Launch evaluation'}
        </button>
        {disabledReason && !running && <span className="text-xs text-white/40">{disabledReason}</span>}

        {evalStatus === 'done' && typeof score === 'number' && (
          <div className="ml-auto flex items-center gap-2 text-sm text-white">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
            <span>
              Score {(Math.min(10, (score / 9) * 10)).toFixed(1)}/10 ·{' '}
              <span className="font-semibold">{myProjectContribution!.reward} CP</span> earned
            </span>
          </div>
        )}
      </div>

      {evalStatus === 'failed' && (
        <p className="flex items-center gap-2 text-xs text-red-400">
          <XCircle className="h-3.5 w-3.5" /> Evaluation failed — check your repository and try again.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** Small pill carrying the workspace state, in the mockup's far-end slot. */
function StatusPill({ tone, children }: { tone: 'ready' | 'pending' | 'failed'; children: React.ReactNode }) {
  const toneClass = tone === 'ready'
    ? 'bg-green-500/10 text-green-400'
    : tone === 'failed'
      ? 'bg-red-500/10 text-red-400'
      : 'bg-white/[0.06] text-white/45';
  return (
    <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${toneClass}`}>
      {tone === 'ready' && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
      {children}
    </span>
  );
}
