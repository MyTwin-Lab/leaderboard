'use client';

import { Trophy } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { Badge } from '@/components/ui/Badge';
import { ContributionRewardBreakdown } from '@/components/contributor/ContributionRewardBreakdown';
import { fmt, sectionHeader } from './format';
import { RepoActivityFeed } from '@/distribution/mytwin.activity';

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

/**
 * Challenge activity: ledger contributions plus the linked repo's events.
 *
 * The manage view and the public challenge page each had their own version of
 * this. The page's took only `repoActivity` and could not attribute anything;
 * this one is the manage view's, so both now show who did what.
 */
export function ChallengeActivity({ contributions, team, repoActivity, showRewardBreakdown }: {
  contributions: Contribution[]; team: TeamMember[];
  repoActivity: Record<string, any> | null; showRewardBreakdown: boolean;
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
                {showRewardBreakdown
                  ? <ContributionRewardBreakdown contributionId={c.uuid} title={c.title ?? c.type ?? "Contribution"} reward={c.reward} index={i} />
                  : <span className="shrink-0 text-sm font-semibold text-brandCP">{c.reward} CP</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repository activity, rendered by each connector's feed */}
      <RepoActivityFeed activities={repoActivity} />
    </div>
  );
}
