'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { TeamAvatars } from '@/components/ui/TeamAvatars';
import { ContributorTabs } from '@/components/contributor/ContributorTabs';
import {
  ArrowLeft, Video, CheckCircle2, Circle, CalendarDays, BrainCircuit,
  GitBranch, GitPullRequest, Trophy, BarChart2, FlaskConical, Medal, FileText,
  Database, Cpu, ExternalLink,
} from 'lucide-react';
import type { TeamMember } from '@/lib/types';
import { trackOnboardingStep } from '@/lib/onboarding-track';
import { MLChallengeFlow } from '@/components/challenges/MLChallengeFlow';
import { DocumentsDrawer } from '@/components/challenges/DocumentsDrawer';

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
}

interface TaskWithAssignees {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  status: string;
  parent_task_id?: string;
  assignees: TeamMember[];
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationMin(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

const TASK_STATUS: Record<string, { dot: string; label: string; order: number }> = {
  in_progress: { dot: 'bg-yellow-400 ring-2 ring-yellow-400/30', label: 'In progress', order: 0 },
  todo:        { dot: 'bg-white/25',                              label: 'Todo',        order: 1 },
  open:        { dot: 'bg-white/25',                              label: 'Open',        order: 1 },
  scheduled:   { dot: 'bg-white/25',                              label: 'Scheduled',   order: 1 },
  backlog:     { dot: 'bg-white/15',                              label: 'Backlog',     order: 2 },
  done:        { dot: 'bg-green-500',                             label: 'Done',        order: 3 },
  completed:   { dot: 'bg-green-500',                             label: 'Done',        order: 3 },
};

function taskStatusInfo(status: string) {
  return TASK_STATUS[status] ?? { dot: 'bg-white/20', label: status, order: 2 };
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

// ─── Meeting row (upcoming) ───────────────────────────────────────────────

function UpcomingMeetingRow({
  meeting,
  onClick,
  onJoin,
}: {
  meeting: SyncMeeting;
  onClick: () => void;
  onJoin?: () => void;
}) {
  const isLive = meeting.status === 'in_progress';
  const d = new Date(meeting.start_time);
  const day   = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dur = durationMin(meeting.start_time, meeting.end_time);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="group flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03]
        px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40
        cursor-pointer"
    >
      {/* Date block */}
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="text-[10px] font-medium uppercase tracking-widest text-primary-100/40">{weekday}</span>
        <span className="text-xl font-bold leading-none text-white">{day}</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-primary-100/40">{month}</span>
      </div>

      {/* Divider */}
      <div className="h-10 w-px shrink-0 bg-primary-100/12" />

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              LIVE
            </span>
          )}
          <span className="truncate text-sm font-medium text-white group-hover:text-brandCP transition-colors">
            {meeting.title}
          </span>
        </div>
        <span className="text-xs text-white/35">
          {formatTime(meeting.start_time)} – {formatTime(meeting.end_time)}
          <span className="ml-1.5 text-white/20">· {dur}min</span>
        </span>
      </div>

      {/* Join button */}
      {meeting.meet_link ? (
        <button
          onClick={e => { e.stopPropagation(); onJoin?.(); }}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-brandCP/15 px-3 py-1.5
            text-xs font-semibold text-brandCP transition-all duration-200
            hover:bg-brandCP/25 hover:shadow-[0_0_12px_rgba(10,247,193,0.15)]"
        >
          <Video className="h-3 w-3" />
          Join
        </button>
      ) : (
        <svg
          className="h-4 w-4 shrink-0 text-white/0 transition-all duration-200 group-hover:text-white/25"
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
}

// ─── Past meeting row ─────────────────────────────────────────────────────

function PastMeetingRow({ meeting, onClick }: { meeting: SyncMeeting; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left
        transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-none"
    >
      <span className="text-[11px] tabular-nums text-white/25 w-14 shrink-0">
        {formatDate(meeting.start_time, { month: 'short', day: 'numeric' })}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-white/50 group-hover:text-white/70 transition-colors">
        {meeting.title}
      </span>
      <Badge label={meeting.status === 'processed' ? 'Processed' : 'Completed'} variant="muted" />
    </button>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isSubtask = false,
  onAssign,
  assigning,
}: {
  task: TaskWithAssignees;
  isSubtask?: boolean;
  onAssign: () => void;
  assigning: boolean;
}) {
  const si = taskStatusInfo(task.status);
  const isDone = task.status === 'done' || task.status === 'completed';
  const canAssign = task.type === 'concurrent' || task.assignees.length === 0;

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl transition-all duration-200
        hover:bg-white/[0.04]
        ${isSubtask ? 'py-2 pl-3 pr-3' : 'py-3 px-3'}`}
    >
      {/* Status dot */}
      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${si.dot} ${task.status === 'in_progress' ? 'animate-pulse' : ''}`} />

      {/* Title + description */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`text-sm font-medium leading-snug transition-colors ${
          isDone ? 'text-white/35 line-through decoration-white/20' : 'text-white group-hover:text-white'
        }`}>
          {task.title}
        </span>
        {task.description && !isSubtask && (
          <span className="mt-0.5 line-clamp-1 text-xs text-white/30">{task.description}</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-2">
        {task.type === 'concurrent' && (
          <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30 sm:inline">
            concurrent
          </span>
        )}
        {task.assignees.length > 0 && (
          <TeamAvatars members={task.assignees} maxDisplay={3} />
        )}
        {canAssign && (
          <button
            onClick={onAssign}
            disabled={assigning || isDone}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40
              disabled:cursor-not-allowed disabled:opacity-50
              ${isDone
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-brandCP/10 text-brandCP hover:bg-brandCP/20 hover:shadow-[0_0_12px_rgba(10,247,193,0.1)]'
              }`}
          >
            {assigning ? '…' : 'Assign'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignees[]>([]);
  const [meetings, setMeetings] = useState<SyncMeeting[]>([]);
  const [meetingsEnabled, setMeetingsEnabled] = useState(false);
  const [repoTypes, setRepoTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [docsDrawerOpen, setDocsDrawerOpen] = useState(false);
  const [repoActivity, setRepoActivity] = useState<Record<string, any> | null>(null);

  const isML = challenge?.type === 'ml' || repoTypes.some(t => ML_REPO_TYPES.includes(t));

  useEffect(() => {
    if (challengeId) {
      fetchAll();
      trackOnboardingStep('clicked_challenge');
    }
  }, [challengeId]);

  const fetchModules = async () => {
    const res = await fetch('/api/modules');
    if (res.ok) {
      const data = await res.json();
      setMeetingsEnabled(data.meetings_enabled !== false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchChallenge(), fetchTeam(), fetchTasks(), fetchMeetings(), fetchRepos(), fetchRepoActivity(), fetchModules()]);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchChallenge = async () => {
    const res = await fetch(`/api/challenges/${challengeId}`);
    if (res.ok) setChallenge(await res.json());
  };

  const fetchTeam = async () => {
    const res = await fetch(`/api/challenges/${challengeId}/team`);
    if (res.ok) {
      const data = await res.json();
      setTeam(Array.isArray(data) ? data.map((m: any) => ({ id: m.uuid, fullName: m.full_name, avatarUrl: m.avatar_url ?? undefined })) : []);
    }
  };

  const fetchTasks = async () => {
    const res = await fetch(`/api/tasks?challenge_id=${challengeId}&include=assignees`);
    if (res.ok) {
      const data = await res.json();
      setTasks((Array.isArray(data) ? data : []).map((t: any) => ({
        ...t,
        assignees: Array.isArray(t.assignees)
          ? t.assignees.map((a: any) => ({ id: a.uuid, fullName: a.full_name, avatarUrl: a.avatar_url ?? undefined }))
          : [],
      })));
    }
  };

  const fetchMeetings = async () => {
    const res = await fetch(`/api/sync-meetings?challenge_id=${challengeId}`);
    if (res.ok) {
      const data = await res.json();
      setMeetings(data.meetings || []);
    }
  };

  const fetchRepos = async () => {
    const res = await fetch(`/api/challenges/${challengeId}/repos`);
    if (res.ok) {
      const data = await res.json();
      setRepoTypes((Array.isArray(data) ? data : []).map((r: any) => r.repo_type ?? r.type ?? ''));
    }
  };

  const fetchRepoActivity = async () => {
    const res = await fetch(`/api/challenges/${challengeId}/repo-activity`);
    if (res.ok) {
      const data = await res.json();
      if (data?.activities) setRepoActivity(data.activities);
    }
  };

  const handleAssignTask = async (taskId: string) => {
    setAssigningTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, { method: 'POST' });
      if (res.ok) {
        trackOnboardingStep('assigned_task');
        router.push(`/tasks/${taskId}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign');
      }
    } catch { alert('Network error'); }
    finally { setAssigningTaskId(null); }
  };

  if (loading) return <Skeleton />;

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-32 text-white/40 text-sm">
        Challenge not found.
      </div>
    );
  }

  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const completion = tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100);

  const parentTasks = tasks
    .filter(t => !t.parent_task_id)
    .sort((a, b) => taskStatusInfo(a.status).order - taskStatusInfo(b.status).order);

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
        </div>

        {/* Title */}
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {challenge.title}
          </h1>
          <button
            onClick={() => setDocsDrawerOpen(true)}
            title="Documents"
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-brandCP/30 hover:bg-brandCP/[0.07] hover:text-brandCP/70 hover:shadow-[0_4px_16px_rgba(10,247,193,0.1)] active:translate-y-0"
          >
            <FileText className="h-3.5 w-3.5" />
            Docs
          </button>
        </div>

        {/* Description */}
        {challenge.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-white/50">
            {challenge.description}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap items-center gap-5">
          {/* CP */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">
              {challenge.contribution_points_reward.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-brandCP">CP</span>
          </div>

          {!isML && (
            <>
              <div className="h-6 w-px bg-primary-100/12" />

              {/* Tasks progress */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-white">{completion}%</span>
                <span className="text-sm text-white/35">
                  ({doneTasks}/{tasks.length} tasks)
                </span>
              </div>
            </>
          )}

          <div className="h-6 w-px bg-primary-100/12" />

          {/* Team */}
          <div className="flex items-center gap-2">
            <TeamAvatars members={team} />
            {team.length > 0 && (
              <span className="text-xs text-white/35">
                {team.length} member{team.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar — hidden for ML challenges */}
        {!isML && (
          <div className="mt-4 h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP transition-[width] duration-700 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <ContributorTabs tabs={isML ? [
        {
          label: 'Submission',
          panel: <TabMLSubmission challengeId={challengeId} meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} meetingsEnabled={meetingsEnabled} />,
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
              tasks={tasks}
              parentTasks={parentTasks}
              doneTasks={doneTasks}
              completion={completion}
              meetings={meetings}
              upcomingMeetings={upcomingMeetings}
              pastMeetings={pastMeetings}
              assigningTaskId={assigningTaskId}
              onAssign={handleAssignTask}
              router={router}
              meetingsEnabled={meetingsEnabled}
            />
          ),
        },
        {
          label: 'Activity',
          panel: <TabActivity repoActivity={repoActivity} />,
        },
      ]} />

    </div>

    {/* Drawer rendered OUTSIDE the animate-fade-up div to avoid transform containing-block breaking position:fixed */}
    <DocumentsDrawer
      challengeId={challengeId}
      isAdmin={false}
      open={docsDrawerOpen}
      onClose={() => setDocsDrawerOpen(false)}
    />
    </>
  );
}

// ─── Tab: Tasks (code) ────────────────────────────────────────────────────

function TabTasks({
  tasks, parentTasks, doneTasks, completion,
  meetings, upcomingMeetings, pastMeetings,
  assigningTaskId, onAssign, router, meetingsEnabled,
}: {
  tasks: TaskWithAssignees[];
  parentTasks: TaskWithAssignees[];
  doneTasks: number;
  completion: number;
  meetings: SyncMeeting[];
  upcomingMeetings: SyncMeeting[];
  pastMeetings: SyncMeeting[];
  assigningTaskId: string | null;
  onAssign: (id: string) => void;
  router: ReturnType<typeof import('next/navigation').useRouter>;
  meetingsEnabled: boolean;
}) {
  return (
    <div className={meetingsEnabled ? "grid gap-8 lg:grid-cols-[300px_1fr]" : ""}>
      {/* Meetings */}
      {meetingsEnabled && (
        <div className="min-w-0">
          <MeetingsSidebar meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} />
        </div>
      )}

      {/* Tasks */}
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-100/35" />
            Tasks
          </h2>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-white/30">{doneTasks}/{tasks.length}</span>
            {tasks.length > 0 && (
              <div className="h-1 w-20 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-brandCP/60 transition-[width] duration-700" style={{ width: `${completion}%` }} />
              </div>
            )}
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-12 text-center">
            <Circle className="h-7 w-7 text-white/15" />
            <p className="text-xs text-white/25">No tasks available</p>
          </div>
        ) : (
          <div className="space-y-1">
            {parentTasks.map((task, idx) => {
              const subtasks = tasks
                .filter(t => t.parent_task_id === task.uuid)
                .sort((a, b) => taskStatusInfo(a.status).order - taskStatusInfo(b.status).order);
              return (
                <div key={task.uuid} className="animate-fade-up rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ animationDelay: `${idx * 40}ms` }}>
                  <TaskRow task={task} onAssign={() => onAssign(task.uuid)} assigning={assigningTaskId === task.uuid} />
                  {subtasks.length > 0 && (
                    <div className="px-3 pb-1.5">
                      <div className="flex items-center gap-2 border-t border-white/5 pt-1.5">
                        <div className="ml-5 h-3 w-px bg-white/10" />
                        <span className="text-[10px] text-white/25">
                          {subtasks.filter(s => s.status === 'done' || s.status === 'completed').length}/{subtasks.length} subtasks done
                        </span>
                      </div>
                    </div>
                  )}
                  {subtasks.map((sub, si) => (
                    <div key={sub.uuid} className="relative pl-5">
                      <div className={`absolute left-6 top-0 w-px bg-white/[0.07] ${si === subtasks.length - 1 ? 'h-1/2' : 'h-full'}`} />
                      <div className="absolute left-6 top-1/2 h-px w-2.5 bg-white/[0.07]" />
                      <TaskRow task={sub} isSubtask onAssign={() => onAssign(sub.uuid)} assigning={assigningTaskId === sub.uuid} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
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
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up transition-colors hover:border-white/12 hover:bg-white/[0.04]"
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
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 animate-fade-up transition-colors hover:border-white/12 hover:bg-white/[0.04]"
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

function TabMLSubmission({
  challengeId, meetings, upcomingMeetings, pastMeetings, router, meetingsEnabled,
}: {
  challengeId: string;
  meetings: SyncMeeting[];
  upcomingMeetings: SyncMeeting[];
  pastMeetings: SyncMeeting[];
  router: ReturnType<typeof import('next/navigation').useRouter>;
  meetingsEnabled: boolean;
}) {
  return (
    <div className={meetingsEnabled ? "grid gap-8 lg:grid-cols-[300px_1fr]" : ""}>
      {meetingsEnabled && (
        <div className="min-w-0">
          <MeetingsSidebar meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} />
        </div>
      )}
      <div className="min-w-0 space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <BrainCircuit className="h-3.5 w-3.5 text-primary-100/35" />
          ML Submission
        </h2>
        <MLChallengeFlow challengeId={challengeId} />
      </div>
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
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
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
                <div key={ref} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-4">
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
                          <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
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

// ─── Meetings sidebar (shared) ────────────────────────────────────────────

function MeetingsSidebar({
  meetings, upcomingMeetings, pastMeetings, router,
}: {
  meetings: SyncMeeting[];
  upcomingMeetings: SyncMeeting[];
  pastMeetings: SyncMeeting[];
  router: ReturnType<typeof import('next/navigation').useRouter>;
}) {
  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
        <Video className="h-3.5 w-3.5 text-primary-100/35" />
        Meetings
        {meetings.length > 0 && (
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-white/40">
            {meetings.length}
          </span>
        )}
      </h2>

      {upcomingMeetings.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary-100/30">Upcoming</p>
          {upcomingMeetings.map(m => (
            <UpcomingMeetingRow
              key={m.uuid}
              meeting={m}
              onClick={() => router.push(`/sync-meetings/${m.uuid}`)}
              onJoin={() => { trackOnboardingStep('joined_meeting'); window.open(m.meet_link, '_blank'); }}
            />
          ))}
        </div>
      )}

      {pastMeetings.length > 0 && (
        <div className="space-y-0.5">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-primary-100/30">Past</p>
          {pastMeetings.map(m => (
            <PastMeetingRow key={m.uuid} meeting={m} onClick={() => router.push(`/sync-meetings/${m.uuid}`)} />
          ))}
        </div>
      )}

      {meetings.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] py-10 text-center">
          <Video className="h-7 w-7 text-white/15" />
          <p className="text-xs text-white/25">No meetings yet</p>
        </div>
      )}
    </div>
  );
}
