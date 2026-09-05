'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/fetchJson';
import {
  ArrowLeft, Users, Trophy, CalendarDays, Code2, BrainCircuit, ShieldCheck,
  CheckCircle2, Circle, Clock3, BarChart2, Activity,
  Medal, ExternalLink, GitBranch, GitPullRequest,
  GitCommit, MessageSquare,
  Database, Package, Cpu, FlaskConical, ChevronDown, Loader2, Plus, FileText, Pencil, Info,
} from 'lucide-react';
import { CreateChallengeDrawer } from '@/components/admin/CreateChallengeDrawer';
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
import { ReferenceCasesOverviewPanel } from '@/components/admin/ReferenceCasesOverviewPanel';
import { ValidationRunsPanel } from '@/components/admin/ValidationRunsPanel';
import { ComputeRequestsPanel } from '@/components/challenges/ComputeRequestsPanel';
import type { MlRewardRules } from '../../../../../packages/database-service/domain/mlRewardRules';
import { ContributorTabs } from '@/components/contributor/ContributorTabs';
import { ContributionRewardBreakdown } from '@/components/contributor/ContributionRewardBreakdown';
import { Badge } from '@/components/ui/Badge';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { CreateMeetingDrawer } from '@/components/admin/CreateMeetingDrawer';
import { DocumentsDrawer } from '@/components/challenges/DocumentsDrawer';
import { RewardRulesDrawer } from '@/components/challenges/RewardRulesDrawer';
import { MeetingsSection } from '@/components/challenges/MeetingsSection';
import { HeroStatCard } from '@/components/challenges/HeroStatCard';
import { HeroStatCarousel } from '@/components/challenges/HeroStatCarousel';
import { ParticipantsProgress } from '@/components/challenges/shared/ParticipantsProgress';
import { TeamAvatars } from '@/components/ui/TeamAvatars';
import { ChallengeActivity } from '@/components/challenges/shared/ChallengeActivity';
import { ChallengeMetrics } from '@/components/challenges/shared/ChallengeMetrics';
import { fmt, sectionHeader } from '@/components/challenges/shared/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  uuid: string; title: string; description?: string;
  status: string; type: string;
  start_date?: string | null; end_date?: string | null;
  contribution_points_reward: number; completion: number;
  project_id: string;
  roadmap?: string;
  reward_rules?: MlRewardRules | null;
  compute_enabled?: boolean | null;
}

interface TeamMember { id: string; fullName: string; githubUsername?: string; avatarUrl?: string; }

interface Task {
  uuid: string; title: string; description?: string;
  status: string;
  user_id?: string | null;
  parent_task_id?: string;
}

interface Participant {
  user_id: string;
  workspace_provider?: string | null;
  workspace_ref?: string | null;
  workspace_url?: string | null;
  workspace_status?: string | null;
}

interface Contribution {
  uuid: string; title: string; type: string; description?: string;
  reward: number; user_id: string; submitted_at: string;
  evaluation?: { globalScore?: number };
  // Only set on type === 'project' contributions (code challenges) — reflects
  // where CodeRewardsService's live evaluation run currently stands.
  evaluation_status?: 'running' | 'done' | 'failed';
}

interface Meeting {
  uuid: string; title: string; status: string;
  start_time: string; end_time: string; meet_link?: string;
}

interface MLRepo {
  repo_id: string; repo_type: string; repo_external_id?: string;
  role: 'dataset' | 'model' | 'model_code' | 'api' | null;
  workspace_meta: { userUrls?: Record<string, string> };
}

interface RankEntry { userId: string; name: string; totalCP: number; count: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────


// ─── Status picker ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft',     dot: 'bg-white/30' },
  { value: 'active',    label: 'Active',    dot: 'bg-brandCP'  },
  { value: 'completed', label: 'Completed', dot: 'bg-green-500' },
  { value: 'archived',  label: 'Archived',  dot: 'bg-white/15' },
] as const;

function StatusPicker({ challengeId, status, onUpdate }: {
  challengeId: string;
  status: string;
  onUpdate: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (value: string) => {
    if (value === status) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/challenges/${challengeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value }),
      });
      if (res.ok) onUpdate(value);
    } finally {
      setSaving(false);
    }
  };

  const current = STATUS_OPTIONS.find(o => o.value === status);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
      >
        {saving
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <span className={`h-2 w-2 rounded-full ${current?.dot ?? 'bg-white/20'}`} />
        }
        {current?.label ?? status}
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-xl border border-white/10 bg-backgroundDark p-1 shadow-xl">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                opt.value === status
                  ? 'bg-white/[0.07] text-white'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-28 rounded-full bg-white/8" />
      <div className="space-y-2">
        <div className="h-8 w-1/2 rounded-xl bg-white/10" />
        <div className="h-3 w-96 rounded-full bg-white/6" />
      </div>
      <div className="flex gap-4">
        {[1,2,3].map(i => <div key={i} className="h-7 w-24 rounded-full bg-white/8" />)}
      </div>
      <div className="h-px bg-white/8" />
      <div className="flex gap-4 border-b border-white/10 pb-0">
        {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 rounded-t bg-white/5" />)}
      </div>
      <div className="h-64 rounded-xl bg-white/5" />
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function TabOverview({ challenge, team, contributions, contributionMembers = [] }: {
  challenge: Challenge; team: TeamMember[]; contributions: Contribution[];
  /** (contribution, user) des contributions de groupe — jointes à `team` ici. */
  contributionMembers?: Array<{ contribution_id: string; user_id: string }>;
}) {
  const isML = challenge.type === 'ml';

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* Left col */}
      <div className="space-y-6">
        {/* Team */}
        <div className="space-y-3">
          {sectionHeader(<Users className="h-3.5 w-3.5" />, 'Team', team.length)}
          <div className="space-y-1">
            {team.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                <div className="shrink-0">
                  <InitialsAvatar
                    name={m.fullName}
                    size={28}
                    avatarUrl={m.avatarUrl}
                    className="rounded-xl bg-white/10 shadow-[0_10px_24px_-6px_rgba(0,0,0,0.4)]"
                  />
                </div>
                <span className="text-sm text-white/70">{m.fullName}</span>
                {m.githubUsername && (
                  <span className="ml-auto text-xs text-white/25">@{m.githubUsername}</span>
                )}
              </div>
            ))}
            {team.length === 0 && <p className="px-2 text-xs text-white/25">No members yet</p>}
          </div>
        </div>
      </div>

      {/* Right col — stats */}
      <div className="space-y-4">
        {sectionHeader(<Activity className="h-3.5 w-3.5" />, 'Contributions', contributions.length)}
        {contributions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] py-12 text-center">
            <Activity className="h-7 w-7 text-white/15" />
            <p className="text-xs text-white/25">No contributions yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {contributions.slice(0, 8).map((c, i) => {
              // Une seule ligne par contribution, quel que soit le nombre
              // d'auteurs : le reward affiché est le total du groupe.
              const authors = contributionMembers
                .filter(m => m.contribution_id === c.uuid)
                .map(m => team.find(t => t.id === m.user_id))
                .filter((m): m is TeamMember => !!m);
              return (
              <div key={c.uuid}
                className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="h-2 w-2 shrink-0 rounded-full bg-brandCP/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-white/30">{fmt(c.submitted_at, { month: 'short', day: 'numeric' })}</p>
                </div>
                {authors.length > 0 && (
                  <span className="shrink-0" title={authors.map(a => a.fullName).join(', ')}>
                    <TeamAvatars members={authors} size={22} maxDisplay={3} />
                  </span>
                )}
                <Badge label={c.type} variant="muted" />
                {isML
                  ? <ContributionRewardBreakdown contributionId={c.uuid} title={c.title} reward={c.reward} index={i} />
                  : <span className="text-sm font-semibold text-brandCP">{c.reward} CP</span>}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Tab (code) ─────────────────────────────────────────────────────


// ─── ML Submissions Tab ───────────────────────────────────────────────────────

// Grouped by role, not repo type: the model's GitHub and the API package are
// both typed 'github' and would otherwise collapse into one section.
const ML_STEP_CONFIG = [
  { key: 'dataset',    label: 'Dataset',     icon: Database },
  { key: 'model',      label: 'Model',       icon: Cpu },
  { key: 'model_code', label: 'Model Code',  icon: GitBranch },
  { key: 'api',        label: 'API Package', icon: Package },
];

function TabMLSubmissions({ mlData, team }: {
  mlData: { currentUserId: string | null; repos: MLRepo[]; users?: Record<string, { fullName: string; avatarUrl?: string }> } | null;
  team: TeamMember[];
}) {
  const teamUserMap = Object.fromEntries(team.map(m => [m.id, m.fullName]));
  const teamAvatarMap = Object.fromEntries(team.map(m => [m.id, m.avatarUrl]));
  const userMap = (uid: string) => mlData?.users?.[uid]?.fullName ?? teamUserMap[uid] ?? uid;
  const avatarMap = (uid: string) => mlData?.users?.[uid]?.avatarUrl ?? teamAvatarMap[uid];

  if (!mlData) return <p className="text-xs text-white/25">Loading…</p>;

  return (
    <div className="space-y-6">
      {ML_STEP_CONFIG.map(step => {
        const Icon = step.icon;
        const repos = mlData.repos.filter(r => r.role === step.key);
        if (repos.length === 0) return null;

        return (
          <div key={step.key} className="space-y-3">
            {sectionHeader(<Icon className="h-3.5 w-3.5" />, step.label)}
            {repos.map(repo => {
              const urls = Object.entries(repo.workspace_meta?.userUrls ?? {});
              return (
                <div key={repo.repo_id} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  {urls.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-white/25">No submissions yet</p>
                  ) : urls.map(([uid, url]) => (
                    <div key={uid} className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0">
                        <InitialsAvatar name={userMap(uid)} size={28} avatarUrl={avatarMap(uid)} />
                      </div>
                      <span className="text-sm text-white/60 flex-1">{userMap(uid)}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate max-w-xs text-xs text-brandCP hover:underline">
                        {url.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


// ─── Rankings Tab ─────────────────────────────────────────────────────────────

function TabRankings({ contributions, team }: { contributions: Contribution[]; team: TeamMember[] }) {
  const userMap = Object.fromEntries(team.map(m => [m.id, m.fullName]));
  const avatarMap = Object.fromEntries(team.map(m => [m.id, m.avatarUrl]));

  const rankings: RankEntry[] = Object.values(
    contributions.reduce<Record<string, RankEntry>>((acc, c) => {
      if (!acc[c.user_id]) acc[c.user_id] = { userId: c.user_id, name: userMap[c.user_id] ?? c.user_id, totalCP: 0, count: 0 };
      acc[c.user_id].totalCP += c.reward;
      acc[c.user_id].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.totalCP - a.totalCP);

  const maxCP = rankings[0]?.totalCP || 1;

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-3 max-w-xl">
      {rankings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] py-12 text-center">
          <Medal className="h-7 w-7 text-white/15" />
          <p className="text-xs text-white/25">No contributions yet — rankings will appear here</p>
        </div>
      ) : rankings.map((entry, i) => (
        <div key={entry.userId}
          className="flex items-center gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <span className="w-6 shrink-0 text-center text-base">
            {i < 3 ? MEDALS[i] : <span className="text-xs text-white/25">#{i + 1}</span>}
          </span>
          <div className="shrink-0">
            <InitialsAvatar
              name={entry.name}
              size={32}
              avatarUrl={avatarMap[entry.userId]}
              className="rounded-xl bg-white/10 shadow-[0_10px_24px_-6px_rgba(0,0,0,0.4)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{entry.name}</p>
            <div className="mt-1 h-1 w-full rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP transition-[width] duration-700 ease-out"
                style={{ width: `${(entry.totalCP / maxCP) * 100}%` }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-white">{entry.totalCP} <span className="text-brandCP text-xs">CP</span></p>
            <p className="text-[10px] text-white/30">{entry.count} contribution{entry.count !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Shared challenge control-room view rendered by two routes:
 *   - /admin/challenges/[id]   (isAdmin = true)  — no manager guard, meetings always on
 *   - /challenges/[id]/manage  (isAdmin = false) — guarded by project managership + meetings module flag
 * The two routes are kept distinct on purpose (separate URLs for logs/analytics).
 */
export function ChallengeManageView({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const { id: challengeId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('');
  // Admins are authorized up front; managers must be verified against the project.
  const [isManager, setIsManager] = useState<boolean | null>(isAdmin ? true : null);
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false);
  const [docsDrawerOpen, setDocsDrawerOpen] = useState(false);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  // Challenge, team, tasks, meetings and contributions come from one
  // aggregated request, shared (same key + raw shape) with the public
  // /challenges/[id] page — visiting one view warms the cache for the other.
  const overviewQuery = useQuery({
    queryKey: ['challenge-overview', challengeId],
    queryFn: () => fetchJson(`/api/challenges/${challengeId}/overview`) as Promise<{
      challenge: Challenge;
      team: any[];
      tasks: any[];
      meetings: Meeting[];
      repos: any[];
      contributions: Contribution[];
      participants: Participant[];
      /** (contribution, user) des contributions de groupe. */
      contribution_members: Array<{ contribution_id: string; user_id: string }>;
    }>,
    enabled: !!challengeId,
  });

  const mlWorkspaceQuery = useQuery({
    queryKey: ['challenge-ml-workspace', challengeId],
    queryFn: () => fetchJson(`/api/challenges/${challengeId}/ml-workspace`),
    enabled: !!challengeId,
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
      pool: number;
      distributed: number;
      remaining: number;
      metric: { name: string; baseline: number; points: number[] } | null;
      bestValue: number | null;
    }>,
    enabled: !!challengeId && ['ml', 'code'].includes(overviewQuery.data?.challenge?.type ?? ''),
  });

  const scalewayStatusQuery = useQuery({
    queryKey: ['scaleway-status'],
    queryFn: () => fetchJson('/api/scaleway/status'),
  });

  // Not challenge-specific — shared across every page that needs it.
  const modulesQuery = useQuery({
    queryKey: ['modules'],
    queryFn: () => fetchJson('/api/modules'),
    enabled: !isAdmin,
    staleTime: 5 * 60_000,
  });

  // Only used to name the (locked) project in the edit drawer.
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchJson('/api/projects'),
    staleTime: 60_000,
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchJson('/api/contributors/me'),
    enabled: !isAdmin,
    staleTime: 5 * 60_000,
  });

  const challenge = overviewQuery.data?.challenge ?? null;
  const team: TeamMember[] = (overviewQuery.data?.team ?? []).map((m: any) => ({
    id: m.uuid, fullName: m.full_name, githubUsername: m.github_username, avatarUrl: m.avatar_url ?? undefined,
  }));
  const tasks: Task[] = overviewQuery.data?.tasks ?? [];
  const participants: Participant[] = overviewQuery.data?.participants ?? [];
  const contributions = overviewQuery.data?.contributions ?? [];
  const contributionMembers = overviewQuery.data?.contribution_members ?? [];
  const meetings = overviewQuery.data?.meetings ?? [];
  const mlData = mlWorkspaceQuery.data ?? null;
  const repoActivity = repoActivityQuery.data ?? null;
  const computeEnabled = !!scalewayStatusQuery.data?.connected;
  // Admin view always shows meetings; manager view respects the global module flag.
  const meetingsEnabled = isAdmin || modulesQuery.data?.meetings_enabled !== false;
  const projects = (projectsQuery.data ?? []).map((p: any) => ({ id: p.uuid, name: p.title }));

  useEffect(() => {
    if (challenge) setStatus(challenge.status);
  }, [challenge?.uuid, challenge?.status]);

  useEffect(() => {
    if (isAdmin || !challenge || meQuery.isLoading) return;
    if (meQuery.isError || !meQuery.data) { router.replace(`/challenges/${challengeId}`); return; }
    const managed: string[] = meQuery.data.managedProjectIds ?? [];
    if (!managed.includes(challenge.project_id)) {
      router.replace(`/challenges/${challengeId}`);
    } else {
      setIsManager(true);
    }
  }, [challenge, isAdmin, meQuery.data, meQuery.isError, meQuery.isLoading, challengeId, router]);

  // repo-activity is excluded on purpose — see the /overview route comment;
  // TabActivity/TabMLMetrics already render their own skeleton while it's null.
  const loading = overviewQuery.isLoading || mlWorkspaceQuery.isLoading
    || scalewayStatusQuery.isLoading || modulesQuery.isLoading || projectsQuery.isLoading;

  if (loading) return <Skeleton />;
  if (isManager !== true) return null;
  if (!challenge) return (
    <div className="flex items-center justify-center py-32 text-sm text-white/40">Challenge not found.</div>
  );

  const isML = challenge.type === 'ml';
  const isValidation = challenge.type === 'validation';
  // A closed challenge is a record: its rules and dates decided points that
  // have already been awarded, so editing them would rewrite history.
  const isOpen = !['completed', 'archived'].includes(status);
  const doneTasks = tasks.filter(t => ['done', 'completed'].includes(t.status)).length;
  const completion = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const TypeIcon = isML ? BrainCircuit : isValidation ? ShieldCheck : Code2;

  const tabs = isML ? [
    {
      label: 'Overview',
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} contributionMembers={contributionMembers} />,
    },
    {
      label: 'Submissions',
      panel: <TabMLSubmissions mlData={mlData} team={team} />,
    },
    {
      label: 'Metrics',
      panel: <ChallengeMetrics repoActivity={repoActivity} />,
    },
    {
      label: 'Rankings',
      panel: <TabRankings contributions={contributions} team={team} />,
    },
    ...(computeEnabled && challenge.compute_enabled ? [{
      label: 'Compute',
      panel: <ComputeRequestsPanel challengeId={challengeId} open />,
    }] : []),
  ] : isValidation ? [
    {
      label: 'Overview',
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} contributionMembers={contributionMembers} />,
    },
    {
      label: 'Targets',
      panel: (
        <div className="space-y-6">
          <ValidationTargetsEditor challengeId={challengeId} open />
          <ReferenceCasesOverviewPanel challengeId={challengeId} open />
          <ValidationRewardsPanel challengeId={challengeId} open />
        </div>
      ),
    },
    {
      label: 'Runs',
      panel: <ValidationRunsPanel challengeId={challengeId} open />,
    },
  ] : [
    {
      label: 'Overview',
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} contributionMembers={contributionMembers} />,
    },
    {
      label: 'Participants',
      panel: (
        <div className="space-y-4">
          {mlRewardsQuery.data && (
            <div className="space-y-1 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">CP pool</p>
              <p className="text-sm text-white/75">
                {mlRewardsQuery.data.remaining.toLocaleString()} / {mlRewardsQuery.data.pool.toLocaleString()} CP remaining
                <span className="ml-1 text-xs text-white/35">
                  ({mlRewardsQuery.data.distributed.toLocaleString()} distributed)
                </span>
              </p>
            </div>
          )}
          <ParticipantsProgress team={team} tasks={tasks} participants={participants} contributions={contributions} showWorkspaceStatus />
        </div>
      ),
    },
    {
      label: 'Activity',
      panel: <ChallengeActivity contributions={contributions} team={team} repoActivity={repoActivity} isML={isML} />,
    },
    {
      label: 'Rankings',
      panel: <TabRankings contributions={contributions} team={team} />,
    },
  ];

  // Actually distributed, not the pool/cap set at creation — reward is already
  // reconciled with the ledger (ML/validation) or the cached column (code).
  const awardedTotal = contributions.reduce((sum, c) => sum + (c.reward ?? 0), 0);

  // Best reported model metric across every submission — repoActivity is
  // already fetched for TabMLMetrics, no extra request needed here. Not every
  // challenge reports AUC specifically (some only have F1 or accuracy), so
  // this picks whichever of the three is actually present, in that priority
  // order, rather than assuming AUC.
  const modelEntry = repoActivity ? Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model') : undefined;
  const allModelVersions: any[] = ((modelEntry as any)?.modelVersions ?? []).flatMap((m: any) => m.versions ?? []);
  const METRIC_PRIORITY = ['auc', 'f1', 'accuracy'] as const;
  const bestMetricKey = METRIC_PRIORITY.find(key => allModelVersions.some(v => v.metrics?.[key] !== undefined && v.metrics?.[key] !== null));
  const bestMetricValue = bestMetricKey
    ? allModelVersions.reduce((best: number | null, v: any) => {
        const val = v.metrics?.[bestMetricKey] !== undefined && v.metrics?.[bestMetricKey] !== null ? Number(v.metrics[bestMetricKey]) : NaN;
        return !Number.isNaN(val) && (best === null || val > best) ? val : best;
      }, null as number | null)
    : null;
  const bestMetricLabel = bestMetricKey === 'auc' ? 'AUC' : bestMetricKey === 'f1' ? 'F1' : bestMetricKey === 'accuracy' ? 'Accuracy' : null;

  const upcomingMeetings = meetings
    .filter(m => ['scheduled', 'in_progress'].includes(m.status))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const pastMeetings = meetings
    .filter(m => ['completed', 'processed'].includes(m.status))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <>
      <div className="mx-auto max-w-5xl animate-fade-up space-y-8">

        {/* Back */}
        <button
          onClick={() => router.push('/challenges')}
          className="group flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Challenges
        </button>

        {/* Hero */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPicker
              challengeId={challengeId}
              status={status}
              onUpdate={s => { setStatus(s); queryClient.invalidateQueries({ queryKey: ['challenge-overview', challengeId] }); }}
            />
            {isOpen && (
              <button
                onClick={() => setEditDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            <span className="flex items-center gap-1.5 rounded-full bg-brandCP/10 px-3 py-1 text-xs font-semibold text-brandCP">
              <TypeIcon className="h-3 w-3" />
              {isML ? 'Machine Learning' : isValidation ? 'Validation' : 'Code'}
            </span>
            {(challenge.start_date || challenge.end_date) && (
              <>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <CalendarDays className="h-3 w-3" />
                  {challenge.start_date ? fmt(challenge.start_date, { month: 'short', day: 'numeric' }) : '—'} → {challenge.end_date ? fmt(challenge.end_date, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{challenge.title}</h1>
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
          {challenge.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-white/50">{challenge.description}</p>
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
                ) : (
                  <HeroStatCard
                    key="tasks"
                    label="Tasks"
                    value={`${completion}%`}
                    meta={`${doneTasks} of ${tasks.length} tasks validated`}
                    barWidth={`${completion}%`}
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

        {/* Tabs */}
        <ContributorTabs
          tabs={tabs}
          extra={meetingsEnabled && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setMeetingDrawerOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-brandCP/10 px-2.5 py-1 text-[11px] font-semibold text-brandCP transition-all hover:bg-brandCP/20"
                >
                  <Plus className="h-3 w-3" />
                  New meeting
                </button>
              </div>
              <MeetingsSection
                meetings={meetings}
                upcomingMeetings={upcomingMeetings}
                pastMeetings={pastMeetings}
                onOpen={id => router.push(`/sync-meetings/${id}`)}
                onJoin={link => window.open(link, '_blank')}
              />
            </div>
          )}
        />
      </div>

      {/* Drawers rendered OUTSIDE the animate-fade-up div — CSS animations with
          transform create a new containing block that breaks position:fixed */}
      {meetingDrawerOpen && (
        <CreateMeetingDrawer
          open={meetingDrawerOpen}
          onClose={() => setMeetingDrawerOpen(false)}
          challengeId={challengeId}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['challenge-overview', challengeId] })}
        />
      )}
      <DocumentsDrawer
        challengeId={challengeId}
        isAdmin={true}
        open={docsDrawerOpen}
        onClose={() => setDocsDrawerOpen(false)}
      />
      <RewardRulesDrawer
        challengeId={challengeId}
        open={rulesDrawerOpen}
        onClose={() => setRulesDrawerOpen(false)}
      />
      {/* Mounted unconditionally: the drawer slides in off `open`, so gating the
          mount on it would render it already at translate-x-0 and skip the
          animation entirely. */}
      <CreateChallengeDrawer
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        projects={projects}
        // `status` is the live one: StatusPicker only updates that state, so
        // challenge.status is stale after a status change and saving would
        // silently revert it.
        challenge={{ ...challenge, status }}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['challenge-overview', challengeId] })}
      />
    </>
  );
}
