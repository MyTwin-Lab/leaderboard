'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ContributorTabs } from '@/components/contributor/ContributorTabs';
import { AlertTriangle, CalendarDays, PlayCircle, Trophy, Users, BarChart2, Video } from 'lucide-react';

/* ── Types ── */
interface Stats {
  activeChallenges: number;
  totalProjects: number;
  registeredUsers: number;
  totalContributions: number;
  publishedGrids: number;
  upcomingMeetings: number;
}
interface ActiveChallenge { uuid: string; title: string; end_date: string; contribution_points_reward: number; }
interface RecentRun { uuid: string; status: string; trigger_type: string; started_at?: string; challengeTitle?: string; durationMs?: number; challenge_id: string; }
interface UpcomingMeeting { uuid: string; title: string; start_time: string; status: string; }

/* ── Helpers ── */
function daysUntil(date: string) { return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms?: number) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/* ── Stat card ── */
function StatCard({ label, value, loading, icon }: { label: string; value: number; loading: boolean; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{label}</span>
        <span className="text-primary-100/30">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">
        {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded-lg bg-white/10" /> : value}
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{title}</h3>
      <Link href={href} className="text-xs text-white/30 transition-colors hover:text-brandCP">View all →</Link>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-xs text-white/25">{label}</p>;
}

/* ── Tab: Overview ── */
function TabOverview({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Active Challenges" value={stats?.activeChallenges ?? 0} loading={loading} icon={<Trophy className="h-4 w-4" />} />
      <StatCard label="Projects" value={stats?.totalProjects ?? 0} loading={loading} icon={<BarChart2 className="h-4 w-4" />} />
      <StatCard label="Users" value={stats?.registeredUsers ?? 0} loading={loading} icon={<Users className="h-4 w-4" />} />
      <StatCard label="Contributions" value={stats?.totalContributions ?? 0} loading={loading} icon={<BarChart2 className="h-4 w-4" />} />
      <StatCard label="Published Grids" value={stats?.publishedGrids ?? 0} loading={loading} icon={<BarChart2 className="h-4 w-4" />} />
      <StatCard label="Upcoming Meetings" value={stats?.upcomingMeetings ?? 0} loading={loading} icon={<Video className="h-4 w-4" />} />
    </div>
  );
}

/* ── Tab: Challenges ── */
function TabChallenges({ challenges, loading }: { challenges: ActiveChallenge[]; loading: boolean }) {
  return (
    <div className="max-w-xl space-y-3">
      <SectionHeader title="Active Challenges" href="/admin/challenges" />
      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}</div>
      ) : challenges.length === 0 ? <Empty label="No active challenges" /> : (
        <div className="space-y-2">
          {challenges.map(c => {
            const days = daysUntil(c.end_date);
            return (
              <Link key={c.uuid} href={`/admin/challenges/${c.uuid}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/10 hover:bg-white/[0.05]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-primary-100/35">{new Date(c.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-brandCP">{c.contribution_points_reward.toLocaleString()} CP</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    days <= 0 ? 'bg-white/10 text-white/40' :
                    days <= 7 ? 'bg-red-500/15 text-red-400' :
                    days <= 14 ? 'bg-yellow-500/15 text-yellow-400' :
                    'bg-white/8 text-white/40'
                  }`}>
                    {days <= 0 ? 'Ended' : `${days}d left`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Runs ── */
function TabRuns({ runs, loading }: { runs: RecentRun[]; loading: boolean }) {
  return (
    <div className="max-w-2xl space-y-3">
      <SectionHeader title="Recent Evaluation Runs" href="/admin/evaluation-runs" />
      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/5" />)}</div>
      ) : runs.length === 0 ? <Empty label="No evaluation runs yet" /> : (
        <div className="space-y-1.5">
          {runs.map(run => (
            <div key={run.uuid} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <Badge label={run.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/70">{run.challengeTitle ?? run.challenge_id.slice(0, 8)}</p>
                {run.started_at && (
                  <p className="text-[11px] text-primary-100/30">
                    {fmtDate(run.started_at)}
                    {run.durationMs && <span className="ml-2">· {fmtDuration(run.durationMs)}</span>}
                  </p>
                )}
              </div>
              <PlayCircle className="h-3.5 w-3.5 shrink-0 text-primary-100/25" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Meetings ── */
function TabMeetings({ meetings, loading }: { meetings: UpcomingMeeting[]; loading: boolean }) {
  return (
    <div className="max-w-xl space-y-3">
      <SectionHeader title="Upcoming Meetings" href="/admin/meetings" />
      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}</div>
      ) : meetings.length === 0 ? <Empty label="No upcoming meetings" /> : (
        <div className="space-y-2">
          {meetings.map(m => (
            <div key={m.uuid} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-white/25" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{m.title}</p>
                <p className="text-xs text-white/35">{fmtDate(m.start_time)}</p>
              </div>
              <Badge label={m.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      fetch('/api/challenges').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/users').then(r => r.json()).catch(() => []),
      fetch('/api/contributions').then(r => r.json()).catch(() => []),
      fetch('/api/evaluation-grids').then(r => r.json()).catch(() => []),
      fetch('/api/sync-meetings').then(r => r.json()).catch(() => ({ meetings: [] })),
      fetch('/api/evaluation-runs?pageSize=5').then(r => r.json()).catch(() => []),
    ]).then(([challenges, projects, users, contributions, grids, meetingsRes, runs]) => {
      const meetings: any[] = meetingsRes?.meetings ?? [];

      setStats({
        activeChallenges: challenges.filter((c: any) => c.status === 'active').length,
        totalProjects: projects.length,
        registeredUsers: users.length,
        totalContributions: contributions.length,
        publishedGrids: grids.filter((g: any) => g.status === 'published').length,
        upcomingMeetings: meetings.filter((m: any) => new Date(m.start_time) > now).length,
      });

      // This list is "what ends soonest": a challenge without an end date has
      // no deadline to rank on, so it has nothing to say here.
      setActiveChallenges(
        challenges.filter((c: any) => c.status === 'active' && c.end_date)
          .sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
      );

      const challengeMap = Object.fromEntries(challenges.map((c: any) => [c.uuid, c.title]));
      setRecentRuns(
        (Array.isArray(runs) ? runs : []).slice(0, 5).map((r: any) => ({
          ...r, challengeTitle: challengeMap[r.challenge_id], durationMs: r.meta?.durationMs,
        }))
      );

      setUpcomingMeetings(
        meetings.filter((m: any) => new Date(m.start_time) > now)
          .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 6)
      );
    }).finally(() => setLoading(false));
  }, []);

  const failedRuns = recentRuns.filter(r => r.status === 'failed');

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Alert */}
      {!loading && failedRuns.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300/80">
            <span className="font-medium text-red-400">{failedRuns.length} evaluation run{failedRuns.length > 1 ? 's' : ''} failed</span>
            {' — '}
            <Link href="/admin/evaluation-runs" className="underline hover:text-red-300">check Runs</Link>
          </p>
        </div>
      )}

      <ContributorTabs tabs={[
        { label: 'Overview',   panel: <TabOverview stats={stats} loading={loading} /> },
        { label: 'Challenges', panel: <TabChallenges challenges={activeChallenges} loading={loading} /> },
        { label: 'Runs',       panel: <TabRuns runs={recentRuns} loading={loading} /> },
        { label: 'Meetings',   panel: <TabMeetings meetings={upcomingMeetings} loading={loading} /> },
      ]} />
    </div>
  );
}
