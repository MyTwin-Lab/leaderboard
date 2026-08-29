'use client';

import { Loader2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { completionPercent } from '@/lib/taskProgress';

interface TeamMember {
  id: string;
  fullName: string;
  githubUsername?: string;
  avatarUrl?: string;
}

/**
 * Per-contributor progress on a code challenge: how far each person's own
 * board has got, and what their project evaluation awarded.
 *
 * Since personal boards landed, every contributor holds their own copy of the
 * template, so a shared board view says nothing — this is the reading that
 * still means something. Purely presentational: every value arrives as a prop,
 * all of them from /api/challenges/[id]/overview.
 */
export function ParticipantsProgress({
  team, tasks, participants, contributions, showWorkspaceStatus = false,
}: {
  team: TeamMember[];
  tasks: Array<{ uuid: string; user_id?: string | null; status: string; parent_task_id?: string }>;
  participants: Array<{ user_id: string; workspace_status?: string | null }>;
  contributions: Array<{ user_id: string; type?: string; reward: number; evaluation_status?: string }>;
  /** Manage view only. The public payload never carries the field, and this
   *  keeps the component correct even if that ever changed. */
  showWorkspaceStatus?: boolean;
}) {
  const rows = team.map(member => {
    // Sub-tasks are excluded: a board's progress is measured on its top-level
    // items, the same ones the contributor sees as their checklist.
    const mine = tasks.filter(t => t.user_id === member.id && !t.parent_task_id);
    const done = mine.filter(t => t.status === 'done').length;
    const participation = participants.find(p => p.user_id === member.id);
    const project = contributions.find(c => c.user_id === member.id && c.type === 'project');
    return {
      member,
      total: mine.length,
      done,
      percent: completionPercent(done, mine.length),
      participation,
      project,
    };
  });

  return (
    <div className="space-y-1.5">
      {rows.map(({ member, total, done, percent, participation, project }) => (
        <div key={member.id} className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <InitialsAvatar name={member.fullName} size={28} avatarUrl={member.avatarUrl} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{member.fullName}</p>
            <p className="text-xs text-white/30">
              {total === 0 ? 'No tasks yet' : `${done}/${total} tasks done`}
              {showWorkspaceStatus && participation?.workspace_status
                ? ` · workspace ${participation.workspace_status}`
                : ''}
            </p>
          </div>

          {total > 0 && (
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8 sm:w-28">
                <div
                  className="h-full rounded-full bg-brandCP/60 transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs font-semibold tabular-nums text-white/70">
                {percent}%
              </span>
            </div>
          )}

          {project?.evaluation_status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brandCP" />}
          {project?.evaluation_status === 'done' && (
            <span className="shrink-0 rounded-full bg-brandCP/10 px-2.5 py-0.5 text-xs font-semibold text-brandCP">
              {project.reward} CP
            </span>
          )}
          {project?.evaluation_status === 'failed' && <span className="shrink-0 text-xs text-red-400">eval failed</span>}
        </div>
      ))}
      {rows.length === 0 && <p className="px-2 py-8 text-center text-xs text-white/25">No participants yet</p>}
    </div>
  );
}
