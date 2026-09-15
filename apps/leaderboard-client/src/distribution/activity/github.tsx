import { GitBranch, GitPullRequest, GitCommit, MessageSquare, ExternalLink } from 'lucide-react';
import { fmt, sectionHeader } from '@/components/challenges/shared/format';
import { githubEventsOf } from '../../../../../content/connectors/github/activity';

/** Only this feed renders relative times, so it travels with it. */
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

const GITHUB_EVENT_CONFIG = {
  commit:         { label: 'Commit',       badge: 'bg-white/15 text-white/50',       icon: GitCommit },
  pull_request:   { label: 'Pull Request', badge: 'bg-purple-500/20 text-purple-300', icon: GitPullRequest },
  pr_review:      { label: 'Review',       badge: 'bg-blue-500/20 text-blue-300',     icon: MessageSquare },
  branch_created: { label: 'Branch',       badge: 'bg-green-500/20 text-green-300',   icon: GitBranch },
} as const;

/** Rendu de l'activité du connecteur GitHub : commits, pull requests, reviews et branches. */
export function GithubActivityFeed({ activities }: { activities: Record<string, unknown> | null }) {
  return (
    <div className="space-y-3">
      {sectionHeader(<GitBranch className="h-3.5 w-3.5" />, 'GitHub Activity')}
      {activities === null ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : (() => {
        const events = githubEventsOf(activities);

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
            {events.slice(0, 50).map((event, i) => {
              const config = GITHUB_EVENT_CONFIG[event.type as keyof typeof GITHUB_EVENT_CONFIG]
                ?? { label: event.type, badge: 'bg-white/10 text-white/40', icon: GitCommit };
              const Icon = config.icon;

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
  );
}
