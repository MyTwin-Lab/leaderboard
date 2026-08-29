'use client';

import { Loader2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';

interface TeamMember {
  id: string;
  fullName: string;
  githubUsername?: string;
  avatarUrl?: string;
}

/**
 * Per-contributor progress on a challenge: how far each person's board has
 * got, and what their project evaluation awarded.
 *
 * Extracted from ChallengeManageView so the public challenge page can render
 * the same rows. Purely presentational — every value arrives as a prop, all of
 * them from /api/challenges/[id]/overview.
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
              {showWorkspaceStatus && participation?.workspace_status
                ? ` · workspace ${participation.workspace_status}`
                : ''}
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
