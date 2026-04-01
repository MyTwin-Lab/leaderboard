'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, CalendarDays, PlayCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Stats {
  activeChallenges: number;
  totalProjects: number;
  registeredUsers: number;
  totalContributions: number;
  publishedGrids: number;
  upcomingMeetings: number;
}

interface ActiveChallenge {
  uuid: string;
  title: string;
  end_date: string;
  contribution_points_reward: number;
}

interface RecentRun {
  uuid: string;
  status: string;
  trigger_type: string;
  started_at?: string;
  challengeTitle?: string;
  durationMs?: number;
  challenge_id: string;
}

interface UpcomingMeeting {
  uuid: string;
  title: string;
  start_time: string;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms?: number) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 sm:p-4">
      <div className="mb-0.5 text-xl font-bold text-brandCP sm:mb-1 sm:text-2xl">
        {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/10" /> : value}
      </div>
      <div className="text-xs text-white/50 sm:text-sm">{label}</div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <Link href={href} className="text-xs text-white/30 hover:text-brandCP transition-colors">
        View all →
      </Link>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-white/25 italic">{label}</p>;
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();

    Promise.all([
      fetch('/api/challenges').then((r) => r.json()).catch(() => []),
      fetch('/api/projects').then((r) => r.json()).catch(() => []),
      fetch('/api/users').then((r) => r.json()).catch(() => []),
      fetch('/api/contributions').then((r) => r.json()).catch(() => []),
      fetch('/api/evaluation-grids').then((r) => r.json()).catch(() => []),
      fetch('/api/sync-meetings').then((r) => r.json()).catch(() => ({ meetings: [] })),
      fetch('/api/evaluation-runs?pageSize=5').then((r) => r.json()).catch(() => []),
    ]).then(([challenges, projects, users, contributions, grids, meetingsRes, runs]) => {
      const meetings: any[] = meetingsRes?.meetings ?? [];

      // Stats
      setStats({
        activeChallenges: challenges.filter((c: any) => c.status === 'active' || c.status === 'open').length,
        totalProjects: projects.length,
        registeredUsers: users.length,
        totalContributions: contributions.length,
        publishedGrids: grids.filter((g: any) => g.status === 'published').length,
        upcomingMeetings: meetings.filter((m: any) => new Date(m.start_time) > now).length,
      });

      // Active challenges sorted by end date
      const active: ActiveChallenge[] = challenges
        .filter((c: any) => c.status === 'active' || c.status === 'open')
        .sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
      setActiveChallenges(active);

      // Recent runs enriched with challenge title
      const challengeMap = Object.fromEntries(challenges.map((c: any) => [c.uuid, c.title]));
      const enrichedRuns: RecentRun[] = (Array.isArray(runs) ? runs : []).slice(0, 5).map((r: any) => ({
        ...r,
        challengeTitle: challengeMap[r.challenge_id],
        durationMs: r.meta?.durationMs,
      }));
      setRecentRuns(enrichedRuns);

      // Upcoming meetings
      const upcoming: UpcomingMeeting[] = meetings
        .filter((m: any) => new Date(m.start_time) > now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 4);
      setUpcomingMeetings(upcoming);
    }).finally(() => setLoading(false));
  }, []);

  const failedRuns = recentRuns.filter((r) => r.status === 'failed');

  return (
    <div className="space-y-6">
      {/* ---- Alert: runs en erreur ---- */}
      {!loading && failedRuns.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="text-sm text-red-300/80">
            <span className="font-medium text-red-400">{failedRuns.length} evaluation run{failedRuns.length > 1 ? 's' : ''} failed</span>
            {' '}— check the{' '}
            <Link href="/admin/evaluation-runs" className="underline hover:text-red-300">
              Runs page
            </Link>
          </div>
        </div>
      )}

      {/* ---- Stats ---- */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:rounded-2xl sm:p-6">
        <h3 className="mb-3 text-sm font-semibold text-white sm:mb-4">Overview</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatCard label="Active Challenges" value={stats?.activeChallenges ?? 0} loading={loading} />
          <StatCard label="Total Projects" value={stats?.totalProjects ?? 0} loading={loading} />
          <StatCard label="Registered Users" value={stats?.registeredUsers ?? 0} loading={loading} />
          <StatCard label="Contributions" value={stats?.totalContributions ?? 0} loading={loading} />
          <StatCard label="Published Grids" value={stats?.publishedGrids ?? 0} loading={loading} />
          <StatCard label="Upcoming Meetings" value={stats?.upcomingMeetings ?? 0} loading={loading} />
        </div>
      </div>

      {/* ---- Bottom 3 columns ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Active challenges */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm lg:col-span-1">
          <SectionHeader title="Active Challenges" href="/admin/challenges" />
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5" />)}
            </div>
          ) : activeChallenges.length === 0 ? (
            <EmptyState label="No active challenges" />
          ) : (
            <div className="space-y-2">
              {activeChallenges.map((c) => {
                const days = daysUntil(c.end_date);
                const urgent = days <= 7;
                return (
                  <Link
                    key={c.uuid}
                    href="/admin/challenges"
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{c.title}</p>
                      <p className="text-xs text-white/40">
                        {new Date(c.end_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      urgent
                        ? 'bg-red-500/15 text-red-400'
                        : days <= 14
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'bg-white/10 text-white/40'
                    }`}>
                      {days <= 0 ? 'Ended' : `${days}d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent evaluation runs */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm lg:col-span-1">
          <SectionHeader title="Recent Runs" href="/admin/evaluation-runs" />
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-white/5" />)}
            </div>
          ) : recentRuns.length === 0 ? (
            <EmptyState label="No evaluation runs yet" />
          ) : (
            <div className="space-y-1.5">
              {recentRuns.map((run) => (
                <div
                  key={run.uuid}
                  className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge label={run.status} />
                      <span className="truncate text-xs text-white/50">
                        {run.challengeTitle ?? run.challenge_id.slice(0, 8)}
                      </span>
                    </div>
                    {run.started_at && (
                      <p className="mt-0.5 text-[11px] text-white/25">
                        {new Date(run.started_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {run.durationMs && (
                          <span className="ml-2 text-white/20">· {formatDuration(run.durationMs)}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <PlayCircle className="ml-2 h-3.5 w-3.5 shrink-0 text-white/15" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming meetings */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm lg:col-span-1">
          <SectionHeader title="Upcoming Meetings" href="/admin/meetings" />
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5" />)}
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <EmptyState label="No upcoming meetings" />
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map((m) => (
                <div
                  key={m.uuid}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5"
                >
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/25" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{m.title}</p>
                    <p className="text-xs text-white/40">{formatDate(m.start_time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
