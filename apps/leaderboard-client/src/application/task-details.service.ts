import {
  TaskRepository,
  TaskAssigneeRepository,
  TaskWorkspaceRepository,
  ChallengeRepository,
  ContributionRepository,
  RepoRepository,
} from '../../../../packages/database-service/repositories/index.js';

export interface WorkspaceDetail {
  repo_id: string;
  repo_title: string;
  repo_type: string | null;
  repo_external_id: string | null | undefined;
  workspace_provider: string | null | undefined;
  workspace_ref: string | null | undefined;
  workspace_url: string | null | undefined;
  workspace_status: string | null | undefined;
  workspace_meta: unknown;
}

export interface TaskDetails {
  currentUserId: string | null;
  task: NonNullable<Awaited<ReturnType<TaskRepository['findById']>>>;
  challenge: {
    uuid: string;
    title: string;
    status: string | null;
    completion: number | null;
    contribution_points_reward: number | null;
  } | null;
  assignees: { uuid: string; full_name: string | null | undefined; github_username: string | null | undefined }[];
  workspaces: WorkspaceDetail[];
  subTasks: Awaited<ReturnType<TaskRepository['findSubTasks']>>;
  contribution: unknown;
}

export class TaskDetailsService {
  private taskRepo = new TaskRepository();
  private taskWorkspaceRepo = new TaskWorkspaceRepository();
  private challengeRepo = new ChallengeRepository();
  private contributionRepo = new ContributionRepository();
  private repoRepo = new RepoRepository();

  async getDetails(taskId: string, userId: string | null): Promise<TaskDetails> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

    const [challenge, assignees, taskWorkspaces, subTasks] = await Promise.all([
      this.challengeRepo.findById(task.challenge_id),
      this.taskRepo.findAssignees(taskId),
      this.taskWorkspaceRepo.findByTaskWithRepo(taskId),
      this.taskRepo.findSubTasks(taskId),
    ]);

    const workspaces: WorkspaceDetail[] = await Promise.all(
      taskWorkspaces.map(async (tw) => {
        const repo = await this.repoRepo.findById(tw.repo_id);
        return {
          repo_id: tw.repo_id,
          repo_title: repo?.title ?? 'Unknown',
          repo_type: tw.repo_type,
          repo_external_id: tw.repo_external_id,
          workspace_provider: tw.workspace_provider,
          workspace_ref: tw.workspace_ref,
          workspace_url: tw.workspace_url,
          workspace_status: tw.workspace_status,
          workspace_meta: tw.workspace_meta,
        };
      })
    );

    const contribution = userId
      ? await this.contributionRepo.findByTaskAndUser(taskId, userId)
      : null;

    return {
      currentUserId: userId,
      task,
      challenge: challenge
        ? {
            uuid: challenge.uuid,
            title: challenge.title,
            status: challenge.status,
            completion: challenge.completion,
            contribution_points_reward: challenge.contribution_points_reward,
          }
        : null,
      assignees: assignees.map((a) => ({
        uuid: a.uuid,
        full_name: a.full_name,
        github_username: a.github_username,
      })),
      workspaces,
      subTasks,
      contribution,
    };
  }
}
