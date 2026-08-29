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

function fmt(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmt(iso, { month: 'short', day: 'numeric' });
}

function sectionHeader(icon: React.ReactNode, label: string, count?: number) {
  return (
    <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
      {icon}
      {label}
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">{count}</span>
      )}
    </h3>
  );
}

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

function TabOverview({ challenge, team, contributions }: {
  challenge: Challenge; team: TeamMember[]; contributions: Contribution[];
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
            {contributions.slice(0, 8).map((c, i) => (
              <div key={c.uuid}
                className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="h-2 w-2 shrink-0 rounded-full bg-brandCP/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-white/30">{fmt(c.submitted_at, { month: 'short', day: 'numeric' })}</p>
                </div>
                <Badge label={c.type} variant="muted" />
                {isML
                  ? <ContributionRewardBreakdown contributionId={c.uuid} title={c.title} reward={c.reward} index={i} />
                  : <span className="text-sm font-semibold text-brandCP">{c.reward} CP</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Tab (code) ───────────────────────────────────────────────────────

const KANBAN_COLS = [
  { key: 'todo',        label: 'To do',       dot: 'bg-white/25',   statuses: ['todo', 'open', 'backlog', 'scheduled'] },
  { key: 'in_progress', label: 'In progress',  dot: 'bg-yellow-400', statuses: ['in_progress'] },
  { key: 'done',        label: 'Done',         dot: 'bg-green-500',  statuses: ['done', 'completed'] },
];

const GITHUB_EVENT_CONFIG = {
  commit:         { label: 'Commit',       badge: 'bg-white/15 text-white/50' },
  pull_request:   { label: 'Pull Request', badge: 'bg-purple-500/20 text-purple-300' },
  pr_review:      { label: 'Review',       badge: 'bg-blue-500/20 text-blue-300' },
  branch_created: { label: 'Branch',       badge: 'bg-green-500/20 text-green-300' },
} as const;

function TabKanban({ tasks, team }: { tasks: Task[]; team: TeamMember[] }) {
  const memberById = new Map(team.map(m => [m.id, m]));
  const cols = KANBAN_COLS.map(col => ({
    ...col,
    tasks: tasks.filter(t => col.statuses.includes(t.status)),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.map(col => (
        <div key={col.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
            <span className="text-xs font-semibold text-white/50">{col.label}</span>
            <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/30">{col.tasks.length}</span>
          </div>
          <div className="space-y-2 min-h-[120px]">
            {col.tasks.map((task, i) => (
              <div key={task.uuid}
                className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2 animate-fade-up hover:border-white/10 hover:bg-white/[0.04] transition-all"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-white/35 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2">
                  {task.user_id && memberById.get(task.user_id) && (
                    <div className="ml-auto rounded-full overflow-hidden" style={{ boxShadow: '0 0 0 1.5px var(--background)' }}>
                      <InitialsAvatar
                        name={memberById.get(task.user_id)!.fullName}
                        size={20}
                        avatarUrl={memberById.get(task.user_id)!.avatarUrl}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {col.tasks.length === 0 && (
              <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.05]">
                <p className="text-xs text-white/15">Empty</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Participants Tab (code) ────────────────────────────────────────────────

function TabParticipants({ team, tasks, participants, contributions }: {
  team: TeamMember[];
  tasks: Array<{ uuid: string; user_id?: string | null; status: string; parent_task_id?: string }>;
  participants: Array<{ user_id: string; workspace_status?: string | null; workspace_url?: string | null; workspace_provider?: string | null }>;
  contributions: Contribution[];
}) {
  const rows = team.map(member => {
    const mine = tasks.filter(t => t.user_id === member.id && !t.parent_task_id);
    const done = mine.filter(t => t.status === 'done').length;
    const participation = participants.find(p => p.user_id === member.id);
    const project = contributions.find(c => c.user_id === member.id && c.type === 'project');
    return { member, total: mine.length, done, participation, project };
  });

  return (
    <div className="space-y-1.5">
      {rows.map(({ member, total, done, participation, project }) => (
        <div key={member.id} className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <InitialsAvatar name={member.fullName} size={28} avatarUrl={member.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{member.fullName}</p>
            <p className="text-xs text-white/30">
              {total === 0 ? 'No tasks yet' : `${done}/${total} tasks done`}
              {participation?.workspace_status ? ` · workspace ${participation.workspace_status}` : ''}
            </p>
          </div>
          {project?.evaluation_status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-brandCP" />}
          {project?.evaluation_status === 'done' && (
            <span className="rounded-full bg-brandCP/10 px-2.5 py-0.5 text-xs font-semibold text-brandCP">
              {project.reward} CP
            </span>
          )}
          {project?.evaluation_status === 'failed' && <span className="text-xs text-red-400">eval failed</span>}
        </div>
      ))}
      {rows.length === 0 && <p className="px-2 py-8 text-center text-xs text-white/25">No participants yet</p>}
    </div>
  );
}

// ─── Activity Tab (code) ─────────────────────────────────────────────────────

function TabActivity({ contributions, team, repoActivity, isML }: {
  contributions: Contribution[]; team: TeamMember[];
  repoActivity: Record<string, any> | null; isML: boolean;
}) {
  const userMap = Object.fromEntries(team.map(m => [m.id, m.fullName]));
  const avatarMap = Object.fromEntries(team.map(m => [m.id, m.avatarUrl]));

  return (
    <div className="space-y-8">
      {/* Contributions */}
      <div className="space-y-3">
        {sectionHeader(<Trophy className="h-3.5 w-3.5" />, 'Contributions', contributions.length)}
        {contributions.length === 0 ? (
          <p className="text-xs text-white/25">No contributions yet</p>
        ) : (
          <div className="space-y-1.5">
            {contributions.map((c, i) => (
              <div key={c.uuid}
                className="flex items-center gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-slide-in-left"
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div className="shrink-0">
                  <InitialsAvatar name={userMap[c.user_id] ?? '?'} size={32} avatarUrl={avatarMap[c.user_id]} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-white/35">{userMap[c.user_id] ?? c.user_id} · {fmt(c.submitted_at, { month: 'short', day: 'numeric' })}</p>
                </div>
                <Badge label={c.type} variant="muted" />
                {isML
                  ? <ContributionRewardBreakdown contributionId={c.uuid} title={c.title} reward={c.reward} index={i} />
                  : <span className="shrink-0 text-sm font-semibold text-brandCP">{c.reward} CP</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GitHub Activity */}
      <div className="space-y-3">
        {sectionHeader(<GitBranch className="h-3.5 w-3.5" />, 'GitHub Activity')}
        {repoActivity === null ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        ) : (() => {
          const githubEntry = Object.values(repoActivity).find((a: any) => a?.type === 'github');
          const events: any[] = githubEntry?.events ?? [];

          if (events.length === 0) {
            return (
              <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-5 py-10 text-center space-y-2">
                <div className="flex items-center justify-center gap-3 text-white/20">
                  <GitBranch className="h-5 w-5" />
                  <GitPullRequest className="h-5 w-5" />
                </div>
                <p className="text-sm text-white/25">No GitHub activity found</p>
              </div>
            );
          }

          return (
            <div className="space-y-1.5">
              {events.slice(0, 50).map((event: any, i: number) => {
                const config = GITHUB_EVENT_CONFIG[event.type as keyof typeof GITHUB_EVENT_CONFIG]
                  ?? { label: event.type, badge: 'bg-white/10 text-white/40' };
                const Icon =
                  event.type === 'pull_request' ? GitPullRequest
                  : event.type === 'pr_review'  ? MessageSquare
                  : event.type === 'branch_created' ? GitBranch
                  : GitCommit;

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 animate-fade-up hover:bg-white/[0.04] transition-colors"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/80">{event.title}</p>
                      <p className="text-[11px] text-white/30">
                        {event.author} · {relativeDate(event.date)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.badge}`}>
                      {config.label}
                    </span>
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

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

// ─── ML Metrics Tab ──────────────────────────────────────────────────────────

function MetricsLineChart({ versions }: {
  versions: Array<{ versionNumber: number; metrics: { auc?: number; f1?: number; accuracy?: number } }>;
}) {
  const W = 320, H = 140;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xs = versions.map(v => v.versionNumber);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
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
    if (pts.length === 0) return '';
    return pts.map((v, i) => {
      const x = toSVGX(v.versionNumber);
      const y = toSVGY(v.metrics[key]!);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="text-white/20">
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={PAD.left} y1={toSVGY(t)}
              x2={PAD.left + innerW} y2={toSVGY(t)}
              stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 3"
            />
            <text x={PAD.left - 4} y={toSVGY(t) + 4} textAnchor="end" fontSize={8} fill="currentColor">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {versions.map(v => (
          <text key={v.versionNumber} x={toSVGX(v.versionNumber)} y={H - 8}
            textAnchor="middle" fontSize={8} fill="currentColor">
            v{v.versionNumber}
          </text>
        ))}
        {LINES.map(({ key, color }) => {
          const d = toPath(key);
          if (!d) return null;
          return <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />;
        })}
        {LINES.map(({ key, color }) =>
          versions
            .filter(v => v.metrics[key] !== undefined)
            .map(v => (
              <circle
                key={`${key}-${v.versionNumber}`}
                cx={toSVGX(v.versionNumber)} cy={toSVGY(v.metrics[key]!)}
                r={3} fill={color}
              />
            ))
        )}
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

function TabMLMetrics({ repoActivity }: { repoActivity: Record<string, any> | null }) {
  if (repoActivity === null) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />)}
      </div>
    );
  }

  const modelEntry = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model');

  return (
    <div className="space-y-8">

      {/* Model metrics */}
      {modelEntry && (() => {
        const modelVersions: Array<{ ref: string; versions: any[] }> = modelEntry.modelVersions ?? [];
        return (
          <div className="space-y-6">
            {sectionHeader(<Cpu className="h-3.5 w-3.5" />, 'Model Metrics')}
            {modelVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
                <p className="text-sm text-white/20">No model versions found</p>
              </div>
            ) : (
              modelVersions.map(({ ref, versions }) => {
                const hasMetrics = versions.some(v =>
                  v.metrics.auc !== undefined || v.metrics.f1 !== undefined || v.metrics.accuracy !== undefined
                );
                return (
                  <div key={ref} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/70">{ref}</p>
                      <span className="text-[10px] text-white/25">
                        {versions.length} version{versions.length !== 1 ? 's' : ''}
                      </span>
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
              })
            )}
          </div>
        );
      })()}

      {/* Empty state */}
      {!modelEntry && (
        <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
          <p className="text-sm text-white/20">No model submissions yet</p>
        </div>
      )}
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
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} />,
    },
    {
      label: 'Submissions',
      panel: <TabMLSubmissions mlData={mlData} team={team} />,
    },
    {
      label: 'Metrics',
      panel: <TabMLMetrics repoActivity={repoActivity} />,
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
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} />,
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
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} />,
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
          <TabParticipants team={team} tasks={tasks} participants={participants} contributions={contributions} />
        </div>
      ),
    },
    {
      label: 'Kanban',
      panel: <TabKanban tasks={tasks} team={team} />,
    },
    {
      label: 'Activity',
      panel: <TabActivity contributions={contributions} team={team} repoActivity={repoActivity} isML={isML} />,
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
