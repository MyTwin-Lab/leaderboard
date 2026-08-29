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
import { ChallengeActivity } from '@/components/challenges/shared/ChallengeActivity';
import { ChallengeMetrics } from '@/components/challenges/shared/ChallengeMetrics';
import { ParticipantsProgress } from '@/components/challenges/shared/ParticipantsProgress';

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

  // Declared before overviewQuery so its refetchInterval closure (below) can
  // read meQuery.data without a temporal-dead-zone hazard.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchJson('/api/contributors/me'),
    staleTime: 5 * 60_000,
    // A 401 here means "not signed in", which is a normal state for this page
    // since it is public. fetchJson throws on any non-2xx, so without
    // retry:false react-query burns three attempts while `loading` below stays
    // true and the visitor sits on the skeleton.
    retry: false,
  });

  const isAnonymous = meQuery.isError;

  // Declared after meQuery on purpose: isAnonymous appears in the dependency
  // array, which is evaluated on every render, so reading it above would hit
  // its temporal dead zone.
  useEffect(() => {
    // trackOnboardingStep posts to a protected route — pointless without a session.
    if (challengeId && !isAnonymous) trackOnboardingStep('clicked_challenge');
  }, [challengeId, isAnonymous]);

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
  // meQuery.isError is the anonymous case, not a failure to wait on.
  const loading = overviewQuery.isLoading || modulesQuery.isLoading
    || (meQuery.isLoading && !meQuery.isError);

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

      {/* ── Signed out: one block, no tabs ───────────────── */}
      {/* Every interactive panel below needs an account, so an anonymous
          visitor gets the single thing worth showing for this challenge type:
          its dataset and model metrics, or how far each contributor has got. */}
      {isAnonymous && (
        isML
          ? <ChallengeMetrics repoActivity={repoActivity} />
          : (
            <ParticipantsProgress
              team={team}
              tasks={tasks}
              participants={participants}
              contributions={contributions}
            />
          )
      )}

      {/* ── Tabs ─────────────────────────────────────────── */}
      {!isAnonymous && (
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
          panel: <ChallengeMetrics repoActivity={repoActivity} />,
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
          panel: <ChallengeActivity contributions={contributions} team={team} repoActivity={repoActivity} isML={isML} />,
        },
      ]} />
      )}

      {isAnonymous && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
          <p className="text-sm text-white/60">
            Sign in to join this challenge and start your own board.
          </p>
          <a
            href={`/signin?from=/challenges/${challengeId}`}
            className="inline-flex items-center justify-center rounded-xl bg-brandCP/20 px-6 py-3 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40"
          >
            Continue with Google
          </a>
        </div>
      )}

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

