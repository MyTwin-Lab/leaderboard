'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ContributorTabs } from '@/components/contributor/ContributorTabs';
import {
  ArrowLeft, CheckCircle2, CalendarDays, BrainCircuit,
  GitBranch, GitPullRequest, Trophy, BarChart2, FlaskConical, Medal, FileText, Info,
  Database, Cpu, ExternalLink,
} from 'lucide-react';
import type { TeamMember } from '@/lib/types';
import { trackOnboardingStep } from '@/lib/onboarding-track';
import { MLChallengeFlow } from '@/components/challenges/MLChallengeFlow';
import { ValidationChallengeFlow } from '@/components/challenges/ValidationChallengeFlow';
import { ReferenceCaseAuthorPanel } from '@/components/challenges/ReferenceCaseAuthorPanel';
import { DocumentsDrawer } from '@/components/challenges/DocumentsDrawer';
import { RewardRulesDrawer } from '@/components/challenges/RewardRulesDrawer';
import { type BoardTask } from '@/components/contributor/ContributorTaskBoard';
import {
  CodeChallengePanel, type CodeParticipation, type ProjectContribution,
} from '@/components/challenges/CodeChallengePanel';
import { MeetingsSection } from '@/components/challenges/MeetingsSection';
import { HeroStatCard } from '@/components/challenges/HeroStatCard';
import { HeroStatCarousel } from '@/components/challenges/HeroStatCarousel';
import { fetchJson } from '@/lib/fetchJson';

const ML_REPO_TYPES = ['kaggle_dataset', 'kaggle_model'];


interface Challenge {
  uuid: string;
  title: string;
  description?: string;
  status: string;
  type: string;
  start_date?: string | null;
  end_date?: string | null;
  contribution_points_reward: number;
  project_id: string;
  workspace_mode?: string;
}

// A task row from the overview — either a template task (no `user_id`) or
// an entry on a specific contributor's personal board.
interface ChallengeTask extends BoardTask {
  user_id?: string | null;
}

// Ledger entries (ML/validation/code contributions) — unrelated to the
// personal task board, but still used for the challenge's stat cards below
// and (for `type === 'project'`) the code-challenge evaluation status.
interface BoardContribution {
  uuid: string;
  task_id?: string;
  user_id: string;
  type?: string;
  evaluation?: { globalScore?: number } | null;
  evaluation_status?: string;
  reward: number;
  submitted_at: string;
}

interface SyncMeeting {
  uuid: string;
  title: string;
  description?: string;
  challenge_id: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function Skeleton() {
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
        <div className="h-7 w-28 rounded-full bg-white/8" />
      </div>
      <div className="h-1.5 w-80 rounded-full bg-white/8" />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-white/5" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const challengeId = params.id as string;

  const [docsDrawerOpen, setDocsDrawerOpen] = useState(false);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);

  useEffect(() => {
    if (challengeId) trackOnboardingStep('clicked_challenge');
  }, [challengeId]);

  // Declared before overviewQuery so its refetchInterval closure (below) can
  // read meQuery.data without a temporal-dead-zone hazard.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchJson('/api/contributors/me'),
    staleTime: 5 * 60_000,
  });

  // Challenge, team, tasks, meetings, repos and contributions all come from
  // one aggregated request instead of 6 separate ones — see the route for why
  // repo-activity stays its own call. Shared query key + shape with
  // ChallengeManageView, so navigating manage <-> public for the same
  // challenge reuses this cache.
  const overviewQuery = useQuery({
    queryKey: ['challenge-overview', challengeId],
    queryFn: () => fetchJson(`/api/challenges/${challengeId}/overview`) as Promise<{
      challenge: Challenge;
      team: any[];
      tasks: any[];
      meetings: SyncMeeting[];
      repos: any[];
      contributions: BoardContribution[];
      participants: CodeParticipation[];
    }>,
    enabled: !!challengeId,
    // Polling while a project evaluation is in flight — the run is async
    // server-side, so this is how the panel notices it finished without the
    // user reloading. Stops as soon as the current user's project
    // contribution leaves pending/running.
    refetchInterval: (query) => {
      const cs = query.state.data?.contributions ?? [];
      const myId = meQuery.data?.user?.id ?? null;
      const mine = cs.find((c: any) => c.user_id === myId && c.type === 'project');
      return mine && ['pending', 'running'].includes(mine.evaluation_status ?? '') ? 3000 : false;
    },
  });

  const repoActivityQuery = useQuery({
    queryKey: ['challenge-repo-activity', challengeId],
    queryFn: async () => {
      const data = await fetchJson(`/api/challenges/${challengeId}/repo-activity`);
      return (data?.activities ?? null) as Record<string, any> | null;
    },
    enabled: !!challengeId,
  });

  // Same source as the "beat the leader" timeline inside MLChallengeFlow —
  // reads the reward ledger (challenge.reward_rules.model.metric), not a live
  // Kaggle call, so it still has a value with no Kaggle credentials configured.
  const mlRewardsQuery = useQuery({
    queryKey: ['challenge-ml-rewards', challengeId],
    queryFn: () => fetchJson(`/api/challenges/${challengeId}/ml-rewards`) as Promise<{
      metric: { name: string; baseline: number; points: number[] } | null;
      bestValue: number | null;
    }>,
    enabled: !!challengeId && overviewQuery.data?.challenge?.type === 'ml',
  });

  // Not challenge-specific — shared across every page that needs it.
  const modulesQuery = useQuery({
    queryKey: ['modules'],
    queryFn: () => fetchJson('/api/modules'),
    staleTime: 5 * 60_000,
  });

  const challenge = overviewQuery.data?.challenge ?? null;
  const team: TeamMember[] = (overviewQuery.data?.team ?? []).map((m: any) => ({
    id: m.uuid, fullName: m.full_name, avatarUrl: m.avatar_url ?? undefined,
  }));
  const tasks: ChallengeTask[] = overviewQuery.data?.tasks ?? [];
  const meetings = overviewQuery.data?.meetings ?? [];
  const meetingsEnabled = modulesQuery.data?.meetings_enabled !== false;
  const repoTypes: string[] = (overviewQuery.data?.repos ?? []).map((r: any) => r.repo_type ?? r.type ?? '');
  const contributions = overviewQuery.data?.contributions ?? [];
  const repoActivity = repoActivityQuery.data ?? null;
  const currentUserId = meQuery.data?.user?.id ?? null;
  const isAdmin = meQuery.data?.user?.role === 'admin';

  // ── Personal code-challenge board: split the raw task list into "my
  // board" (owned by the current user) vs the admin-authored template
  // (no user_id) shown as a teaser to non-members. ──
  const participants: CodeParticipation[] = overviewQuery.data?.participants ?? [];
  const myParticipation = participants.find(p => p.user_id === currentUserId) ?? null;
  const isMember = !!myParticipation;
  const myTasks = tasks.filter(t => t.user_id === currentUserId);
  const templateTasks = tasks.filter(t => !t.user_id);
  const myProjectContribution: ProjectContribution | null =
    contributions.find(c => c.user_id === currentUserId && c.type === 'project') ?? null;

  const isML = challenge?.type === 'ml' || repoTypes.some(t => ML_REPO_TYPES.includes(t));
  const isValidation = challenge?.type === 'validation';

  // Silent refresh after a board mutation — no skeleton flash.
  const reloadBoard = async () => {
    await queryClient.invalidateQueries({ queryKey: ['challenge-overview', challengeId] });
  };

  // repo-activity is excluded on purpose: it hits external connectors and can
  // be slow, but TabActivity/TabMLMetrics already render their own inline
  // skeleton while repoActivity is null — no reason to hold up the rest of
  // the page for it.
  const loading = overviewQuery.isLoading || modulesQuery.isLoading || meQuery.isLoading;

  if (loading) return <Skeleton />;

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-32 text-white/40 text-sm">
        Challenge not found.
      </div>
    );
  }

  // Completion of the CURRENT USER's personal board, not the whole
  // challenge's task pool — each contributor has their own board now.
  const myDoneTasks = myTasks.filter(t => t.status === 'done').length;
  const myCompletion = myTasks.length === 0 ? 0 : Math.round((myDoneTasks / myTasks.length) * 100);
  // Actually distributed, not the pool/cap set at creation — reward is already
  // reconciled with the ledger (ML/validation) or the cached column (code).
  const awardedTotal = contributions.reduce((sum, c) => sum + (c.reward ?? 0), 0);

  // Best reported model metric — same source as MLChallengeFlow's "beat the
  // leader" timeline (the reward ledger), not the live Kaggle connector: that
  // one needs real Kaggle credentials and returns nothing without them.
  const mlRewards = mlRewardsQuery.data;
  const bestMetricValue = mlRewards?.bestValue ?? mlRewards?.metric?.points?.[0] ?? null;
  const bestMetricLabel = mlRewards?.metric?.name ? mlRewards.metric.name.toUpperCase() : null;

  const upcomingMeetings = meetings
    .filter(m => ['scheduled', 'in_progress'].includes(m.status))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastMeetings = meetings
    .filter(m => ['completed', 'processed', 'cancelled'].includes(m.status))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <>
    <div className="mx-auto w-full max-w-5xl animate-fade-up overflow-x-hidden">

      {/* ── Back ─────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/challenges')}
        className="group mb-6 flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Challenges
      </button>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="mb-10">
        {/* Status + dates row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">
            <span className={`h-2 w-2 rounded-full ${{
              active: 'bg-brandCP', completed: 'bg-green-500',
              draft: 'bg-white/30', archived: 'bg-white/15',
            }[challenge.status] ?? 'bg-white/20'}`} />
            {challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
          </span>
          {(challenge.start_date || challenge.end_date) && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1 text-xs text-white/40">
                <CalendarDays className="h-3 w-3 text-primary-100/50" />
                {challenge.start_date ? formatDate(challenge.start_date, { month: 'short', day: 'numeric' }) : '—'}
                {' → '}
                {challenge.end_date ? formatDate(challenge.end_date, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
            </>
          )}
          <span className="rounded-full bg-brandCP/10 px-3 py-1 text-xs font-semibold text-brandCP">
            {isML ? 'ML' : isValidation ? 'Validation' : 'Code'}
          </span>
        </div>

        {/* Title */}
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {challenge.title}
          </h1>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <button
              onClick={() => setDocsDrawerOpen(true)}
              title="Documents"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-brandCP/30 hover:bg-brandCP/[0.07] hover:text-brandCP/70 hover:shadow-[0_4px_16px_rgba(10,247,193,0.1)] active:translate-y-0"
            >
              <FileText className="h-3.5 w-3.5" />
              Docs
            </button>
            <button
              onClick={() => setRulesDrawerOpen(true)}
              title="Reward rules"
              style={{ color: '#000' }}
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)] active:translate-y-0 sm:flex"
            >
              <Info className="h-3.5 w-3.5" style={{ color: '#000' }} />
              Reward rules
            </button>
          </div>
        </div>

        {/* Description */}
        {challenge.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-white/50">
            {challenge.description}
          </p>
        )}

        {/* Hero stat cards */}
        <div className="mt-6">
          <HeroStatCarousel
            cards={[
              <HeroStatCard
                key="cp-awarded"
                label="CP awarded"
                value={awardedTotal.toLocaleString()}
                unit="CP"
                meta={challenge.contribution_points_reward ? `of a ${challenge.contribution_points_reward.toLocaleString()} CP pool` : undefined}
                barWidth={challenge.contribution_points_reward
                  ? `${Math.min(100, Math.round((awardedTotal / challenge.contribution_points_reward) * 100))}%`
                  : undefined}
              />,
              isML ? (
                <HeroStatCard
                  key="metric"
                  label={bestMetricLabel ? `Best ${bestMetricLabel}` : 'Best metric'}
                  value={bestMetricValue !== null ? bestMetricValue.toFixed(3) : '—'}
                  meta={bestMetricValue !== null ? 'from submitted model versions' : 'no metric yet'}
                  barWidth={bestMetricValue !== null ? `${Math.round(bestMetricValue * 100)}%` : undefined}
                />
              ) : isValidation ? (
                <HeroStatCard
                  key="contributions"
                  label="Contributions"
                  value={String(contributions.length)}
                  meta="submissions & verdicts recorded"
                />
              ) : isMember ? (
                <HeroStatCard
                  key="tasks"
                  label="Tasks"
                  value={`${myCompletion}%`}
                  meta={`${myDoneTasks} of ${myTasks.length} tasks done · your board`}
                  barWidth={`${myCompletion}%`}
                />
              ) : (
                <HeroStatCard
                  key="tasks"
                  label="Tasks"
                  value={String(team.length)}
                  unit={team.length === 1 ? 'participant' : 'participants'}
                  meta="join the challenge to start your board"
                />
              ),
              <HeroStatCard
                key="team"
                label="Team"
                value={String(team.length)}
                unit={team.length === 1 ? 'member' : 'members'}
                team={team}
              />,
            ]}
          />
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <ContributorTabs
        extra={meetingsEnabled && (
          <MeetingsSection
            meetings={meetings}
            upcomingMeetings={upcomingMeetings}
            pastMeetings={pastMeetings}
            onOpen={id => router.push(`/sync-meetings/${id}`)}
            onJoin={link => { trackOnboardingStep('joined_meeting'); window.open(link, '_blank'); }}
          />
        )}
        tabs={isValidation ? [
        {
          label: 'Validate',
          panel: (
            <div className="space-y-4">
              <ReferenceCaseAuthorPanel challengeId={challengeId} />
              <ValidationChallengeFlow challengeId={challengeId} />
            </div>
          ),
        },
      ] : isML ? [
        {
          label: 'Submission',
          panel: <TabMLSubmission challengeId={challengeId} />,
        },
        {
          label: 'Metrics',
          panel: <TabMLMetrics repoActivity={repoActivity} />,
        },
      ] : [
        {
          label: 'Tasks',
          panel: (
            <TabTasks
              challengeId={challengeId}
              workspaceMode={(challenge.workspace_mode as 'provided_repo' | 'own_repo' | undefined) ?? 'provided_repo'}
              myTasks={myTasks}
              templateTasks={templateTasks}
              myParticipation={myParticipation}
              myProjectContribution={myProjectContribution}
              isMember={isMember}
              onReload={reloadBoard}
            />
          ),
        },
        {
          label: 'Activity',
          panel: <TabActivity repoActivity={repoActivity} />,
        },
      ]} />

    </div>

    {/* Drawers rendered OUTSIDE the animate-fade-up div to avoid transform containing-block breaking position:fixed */}
    <DocumentsDrawer
      challengeId={challengeId}
      isAdmin={false}
      open={docsDrawerOpen}
      onClose={() => setDocsDrawerOpen(false)}
    />
    <RewardRulesDrawer
      challengeId={challengeId}
      open={rulesDrawerOpen}
      onClose={() => setRulesDrawerOpen(false)}
    />
    </>
  );
}

// ─── Tab: Tasks (code) ────────────────────────────────────────────────────

function TabTasks({
  challengeId, workspaceMode, myTasks, templateTasks, myParticipation, myProjectContribution, isMember, onReload,
}: {
  challengeId: string;
  workspaceMode: 'provided_repo' | 'own_repo';
  myTasks: ChallengeTask[];
  templateTasks: ChallengeTask[];
  myParticipation: CodeParticipation | null;
  myProjectContribution: ProjectContribution | null;
  isMember: boolean;
  onReload: () => Promise<void> | void;
}) {
  // "x/y" header reflects the current user's own board now — each
  // contributor has a separate board, there's no single shared total.
  const doneTasks = myTasks.filter(t => t.status === 'done').length;
  const completion = myTasks.length === 0 ? 0 : Math.round((doneTasks / myTasks.length) * 100);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-100/35" />
            Tasks
          </h2>
          {isMember && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-white/30">{doneTasks}/{myTasks.length}</span>
              {myTasks.length > 0 && (
                <div className="h-1 w-20 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-brandCP/60 transition-[width] duration-700" style={{ width: `${completion}%` }} />
                </div>
              )}
            </div>
          )}
        </div>

        <CodeChallengePanel
          challengeId={challengeId}
          workspaceMode={workspaceMode}
          myTasks={myTasks}
          templateTasks={templateTasks}
          myParticipation={myParticipation}
          myProjectContribution={myProjectContribution}
          isMember={isMember}
          onReload={onReload}
        />
      </div>
    </div>
  );
}

// ─── Tab: Activity ────────────────────────────────────────────────────────────

function TabActivity({ repoActivity }: { repoActivity: Record<string, any> | null }) {
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const githubActivity = repoActivity
    ? Object.values(repoActivity).find((a: any) => a?.type === 'github')
    : undefined;

  const commits = (githubActivity?.events ?? []).filter((e: any) => e.type === 'commit');
  const prs = (githubActivity?.events ?? []).filter((e: any) => e.type === 'pull_request');

  // Still loading
  if (repoActivity === null) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/8" />
            {[1, 2, 3].map(j => <div key={j} className="h-14 rounded-xl bg-white/5" />)}
          </div>
        ))}
      </div>
    );
  }

  if (!githubActivity) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.06] px-5 py-12 text-center space-y-1">
        <GitBranch className="mx-auto h-7 w-7 text-white/15" />
        <p className="text-sm text-white/20">No GitHub repository linked to this challenge</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Commits */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          <GitBranch className="h-3.5 w-3.5 text-primary-100/35" />
          Commits
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">{commits.length}</span>
        </h3>
        {commits.length === 0 ? (
          <p className="text-xs text-white/25 px-1">No commits yet</p>
        ) : (
          <div className="space-y-1.5">
            {commits.map((c: any, i: number) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up transition-colors hover:border-white/12 hover:bg-white/[0.04]"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-white/30">{c.author} · {fmtDate(c.date)}</p>
                </div>
                <span className="shrink-0 rounded bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/25">
                  {c.metadata?.sha?.slice(0, 7)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Pull Requests */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          <GitPullRequest className="h-3.5 w-3.5 text-primary-100/35" />
          Pull Requests
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">{prs.length}</span>
        </h3>
        {prs.length === 0 ? (
          <p className="text-xs text-white/25 px-1">No pull requests yet</p>
        ) : (
          <div className="space-y-1.5">
            {prs.map((pr: any, i: number) => {
              const state: string = pr.metadata?.state ?? 'open';
              return (
                <a
                  key={pr.id}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up transition-colors hover:border-white/12 hover:bg-white/[0.04]"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <GitPullRequest className={`h-3.5 w-3.5 shrink-0 ${state === 'merged' ? 'text-purple-400' : state === 'open' ? 'text-green-400' : 'text-white/30'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">#{pr.metadata?.prNumber} {pr.title}</p>
                    <p className="text-xs text-white/30">{pr.author} · {fmtDate(pr.date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    state === 'merged' ? 'bg-purple-500/15 text-purple-400'
                    : state === 'open' ? 'bg-green-500/15 text-green-400'
                    : 'bg-white/8 text-white/40'
                  }`}>
                    {state}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: ML Submission ───────────────────────────────────────────────────

function TabMLSubmission({ challengeId }: { challengeId: string }) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
        <BrainCircuit className="h-3.5 w-3.5 text-primary-100/35" />
        ML Submission
      </h2>
      <MLChallengeFlow challengeId={challengeId} />
    </div>
  );
}

// ─── ML Metrics chart ────────────────────────────────────────────────────────

function MetricsLineChart({ versions }: {
  versions: Array<{ versionNumber: number; metrics: { auc?: number; f1?: number; accuracy?: number } }>;
}) {
  const W = 320, H = 140;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xs = versions.map(v => v.versionNumber);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const xRange = maxX - minX || 1;
  const toSVGX = (x: number) => PAD.left + ((x - minX) / xRange) * innerW;
  const toSVGY = (y: number) => PAD.top + (1 - y) * innerH;
  const LINES = [
    { key: 'auc'      as const, color: 'var(--color-brandCP, #6366f1)', label: 'AUC' },
    { key: 'f1'       as const, color: '#22c55e',                        label: 'F1' },
    { key: 'accuracy' as const, color: '#3b82f6',                        label: 'Accuracy' },
  ];
  const toPath = (key: 'auc' | 'f1' | 'accuracy') => {
    const pts = versions.filter(v => v.metrics[key] !== undefined);
    if (!pts.length) return '';
    return pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toSVGX(v.versionNumber).toFixed(1)} ${toSVGY(v.metrics[key]!).toFixed(1)}`).join(' ');
  };
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="text-white/20">
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => (
          <g key={t}>
            <line x1={PAD.left} y1={toSVGY(t)} x2={PAD.left + innerW} y2={toSVGY(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 3" />
            <text x={PAD.left - 4} y={toSVGY(t) + 4} textAnchor="end" fontSize={8} fill="currentColor">{t.toFixed(2)}</text>
          </g>
        ))}
        {versions.map(v => (
          <text key={v.versionNumber} x={toSVGX(v.versionNumber)} y={H - 8} textAnchor="middle" fontSize={8} fill="currentColor">v{v.versionNumber}</text>
        ))}
        {LINES.map(({ key, color }) => { const d = toPath(key); return d ? <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" /> : null; })}
        {LINES.map(({ key, color }) => versions.filter(v => v.metrics[key] !== undefined).map(v => (
          <circle key={`${key}-${v.versionNumber}`} cx={toSVGX(v.versionNumber)} cy={toSVGY(v.metrics[key]!)} r={3} fill={color} />
        )))}
      </svg>
      <div className="mt-2 flex gap-4">
        {LINES.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: ML Metrics ──────────────────────────────────────────────────────

function TabMLMetrics({ repoActivity }: { repoActivity: Record<string, any> | null }) {
  if (repoActivity === null) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />)}
      </div>
    );
  }

  const datasetEntry = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_dataset');
  const modelEntry   = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model');

  return (
    <div className="space-y-8">
      {/* Dataset card */}
      {datasetEntry?.datasetMeta && (() => {
        const meta = datasetEntry.datasetMeta;
        return (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              <Database className="h-3.5 w-3.5 text-primary-100/35" />
              Dataset
            </h3>
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{meta.title}</p>
                {meta.url && (
                  <a href={meta.url} target="_blank" rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-brandCP hover:underline">
                    Kaggle <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {meta.description && <p className="text-xs text-white/40 line-clamp-3">{meta.description}</p>}
              {meta.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {meta.tags.slice(0, 8).map((tag: string) => (
                    <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40">{tag}</span>
                  ))}
                </div>
              )}
              {meta.lastUpdated && (
                <p className="text-[11px] text-white/25">
                  Updated {new Date(meta.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Model metrics */}
      {modelEntry && (() => {
        const modelVersions: Array<{ ref: string; versions: any[] }> = modelEntry.modelVersions ?? [];
        return (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              <Cpu className="h-3.5 w-3.5 text-primary-100/35" />
              Model Metrics
            </h3>
            {modelVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
                <p className="text-sm text-white/20">No model versions found</p>
              </div>
            ) : modelVersions.map(({ ref, versions }) => {
              const hasMetrics = versions.some(v =>
                v.metrics.auc !== undefined || v.metrics.f1 !== undefined || v.metrics.accuracy !== undefined
              );
              return (
                <div key={ref} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white/70">{ref}</p>
                    <span className="text-[10px] text-white/25">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                  </div>
                  {!hasMetrics ? (
                    <p className="text-xs text-white/25">No metrics found in model card</p>
                  ) : versions.length === 1 ? (
                    <div className="flex flex-wrap gap-3">
                      {(['auc', 'f1', 'accuracy'] as const).map(key => {
                        const val = versions[0].metrics[key];
                        if (val === undefined) return null;
                        return (
                          <div key={key} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-white/30">{key.toUpperCase()}</p>
                            <p className="text-lg font-bold text-white">{val.toFixed(3)}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <MetricsLineChart versions={versions} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {!datasetEntry && !modelEntry && (
        <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
          <BrainCircuit className="mx-auto mb-2 h-7 w-7 text-white/15" />
          <p className="text-sm text-white/20">No Kaggle data available for this challenge</p>
        </div>
      )}
    </div>
  );
}

