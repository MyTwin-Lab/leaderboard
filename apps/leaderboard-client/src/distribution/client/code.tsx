import { CheckCircle2 } from 'lucide-react';
import { flowConfigView } from '@/lib/flowConfig';
import type { ContributorSlotContext, ContributorTask, FlowUiSlots } from '@/lib/flowSlots';
import { CodeChallengePanel } from '@/components/challenges/CodeChallengePanel';
import { ChallengeActivity } from '@/components/challenges/shared/ChallengeActivity';
import { ParticipantsProgress } from '@/components/challenges/shared/ParticipantsProgress';
import { CodeRules } from '@/components/challenges/rules/CodeRules';

function boardProgress(tasks: ContributorTask[]) {
  const done = tasks.filter(t => t.status === 'done').length;
  return { done, completion: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100) };
}

function TasksTab({ ctx }: { ctx: ContributorSlotContext }) {
  // "x/y" header reflects the current user's own board — each contributor has
  // a separate board, there's no single shared total.
  const { done, completion } = boardProgress(ctx.myTasks);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-100/35" />
            Tasks
          </h2>
          {ctx.isMember && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-white/30">{done}/{ctx.myTasks.length}</span>
              {ctx.myTasks.length > 0 && (
                <div className="h-1 w-20 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-brandCP/60 transition-[width] duration-700" style={{ width: `${completion}%` }} />
                </div>
              )}
            </div>
          )}
        </div>

        <CodeChallengePanel
          challengeId={ctx.challengeId}
          workspaceMode={flowConfigView(ctx.challenge).workspace_mode}
          myTasks={ctx.myTasks}
          templateTasks={ctx.templateTasks}
          myParticipation={ctx.myParticipation}
          myProjectContribution={ctx.myProjectContribution}
          isMember={ctx.isMember}
          onReload={ctx.reloadBoard}
        />
      </div>
    </div>
  );
}

/** Flow code : un board personnel et une branche par participant, le pool payé à l'évaluation. */
export const codeSlots: FlowUiSlots = {
  readsRewards: true,

  contributorTabs: (ctx) => [
    { label: 'Tasks', panel: <TasksTab ctx={ctx} /> },
    {
      label: 'Activity',
      panel: <ChallengeActivity contributions={ctx.contributions} team={ctx.team} repoActivity={ctx.repoActivity} showRewardBreakdown={false} />,
    },
  ],

  // Completion of the visitor's own board, not the whole challenge's task pool.
  contributorHeroStat: (ctx) => {
    if (!ctx.isMember) {
      return {
        key: 'tasks',
        label: 'Tasks',
        value: String(ctx.team.length),
        unit: ctx.team.length === 1 ? 'participant' : 'participants',
        meta: 'join the challenge to start your board',
      };
    }
    const { done, completion } = boardProgress(ctx.myTasks);
    return {
      key: 'tasks',
      label: 'Tasks',
      value: `${completion}%`,
      meta: `${done} of ${ctx.myTasks.length} tasks done · your board`,
      barWidth: `${completion}%`,
    };
  },

  manageTabs: (ctx) => [
    ctx.common.overview,
    {
      label: 'Participants',
      panel: (
        <div className="space-y-4">
          {ctx.rewards && typeof ctx.rewards.pool === 'number' && (
            <div className="space-y-1 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">CP pool</p>
              <p className="text-sm text-white/75">
                {(ctx.rewards.remaining ?? 0).toLocaleString()} / {ctx.rewards.pool.toLocaleString()} CP remaining
                <span className="ml-1 text-xs text-white/35">
                  ({(ctx.rewards.distributed ?? 0).toLocaleString()} distributed)
                </span>
              </p>
            </div>
          )}
          <ParticipantsProgress team={ctx.team} tasks={ctx.tasks} participants={ctx.participants} contributions={ctx.contributions} showWorkspaceStatus />
        </div>
      ),
    },
    {
      label: 'Activity',
      panel: <ChallengeActivity contributions={ctx.contributions} team={ctx.team} repoActivity={ctx.repoActivity} showRewardBreakdown={false} />,
    },
    ctx.common.rankings,
  ],

  manageHeroStat: (ctx) => {
    const done = ctx.tasks.filter(t => ['done', 'completed'].includes(t.status)).length;
    const completion = ctx.tasks.length ? Math.round((done / ctx.tasks.length) * 100) : 0;
    return {
      key: 'tasks',
      label: 'Tasks',
      value: `${completion}%`,
      meta: `${done} of ${ctx.tasks.length} tasks validated`,
      barWidth: `${completion}%`,
    };
  },

  rulesView: CodeRules,
};
