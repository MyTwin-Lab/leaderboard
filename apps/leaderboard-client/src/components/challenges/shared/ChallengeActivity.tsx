'use client';

import {
  Trophy, GitBranch, GitPullRequest, GitCommit, MessageSquare, ExternalLink,
} from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { Badge } from '@/components/ui/Badge';
import { ContributionRewardBreakdown } from '@/components/contributor/ContributionRewardBreakdown';
import { fmt, sectionHeader } from './format';

/** Only this view renders relative times, so it travels with the component. */
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

interface TeamMember {
  id: string;
  fullName: string;
  githubUsername?: string;
  avatarUrl?: string;
}

interface Contribution {
  uuid: string; type?: string; description?: string;
  /** Absent on the challenge page, whose payload carries no contribution
   *  titles — fall back to the contribution type there. */
  title?: string;
  reward: number; user_id: string; submitted_at: string;
  evaluation?: { globalScore?: number } | null;
  evaluation_status?: string;
}

const GITHUB_EVENT_CONFIG = {
  commit:         { label: 'Commit',       badge: 'bg-white/15 text-white/50' },
  pull_request:   { label: 'Pull Request', badge: 'bg-purple-500/20 text-purple-300' },
  pr_review:      { label: 'Review',       badge: 'bg-blue-500/20 text-blue-300' },
  branch_created: { label: 'Branch',       badge: 'bg-green-500/20 text-green-300' },
} as const;

/**
 * Challenge activity: ledger contributions plus the linked repo's events.
 *
 * The manage view and the public challenge page each had their own version of
 * this. The page's took only `repoActivity` and could not attribute anything;
 * this one is the manage view's, so both now show who did what.
 */
export function ChallengeActivity({ contributions, team, repoActivity, isML }: {
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
                  <p className="truncate text-sm font-medium text-white">{c.title ?? c.type ?? "Contribution"}</p>
                  <p className="text-xs text-white/35">{userMap[c.user_id] ?? c.user_id} · {fmt(c.submitted_at, { month: 'short', day: 'numeric' })}</p>
                </div>
                <Badge label={c.type ?? "contribution"} variant="muted" />
                {isML
                  ? <ContributionRewardBreakdown contributionId={c.uuid} title={c.title ?? c.type ?? "Contribution"} reward={c.reward} index={i} />
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
