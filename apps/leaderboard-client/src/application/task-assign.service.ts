import {
  TaskRepository,
  TaskAssigneeRepository,
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  TaskWorkspaceRepository,
  UserRepository,
} from '../../../../packages/database-service/repositories/index.js';
import { provisionTaskWorkspace, ProvisionerRegistry } from '../../../../packages/provisioner/src/index.js';
import { mapRepoTypeToWorkspaceType } from '../../../../packages/provisioner/src/utils.js';
import { ConnectorRegistry } from '../../../../packages/connectors/registry.js';

export interface ProvisioningResult {
  repo_id: string;
  status: string;
  workspace?: unknown;
  result?: unknown;
  error?: string;
}

export interface AssignResult {
  assignment: unknown;
  provisioning: ProvisioningResult[];
}

function createHttpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class TaskAssignService {
  private taskRepo = new TaskRepository();
  private taskAssigneeRepo = new TaskAssigneeRepository();
  private challengeRepo = new ChallengeRepository();
  private challengeRepoRepo = new ChallengeRepoRepository();
  private taskWorkspaceRepo = new TaskWorkspaceRepository();
  private challengeTeamRepo = new ChallengeTeamRepository();
  private userRepo = new UserRepository();

  async assign(taskId: string, userId: string): Promise<AssignResult> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw createHttpError('Task not found', 404);

    const alreadyAssigned = await this.taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (alreadyAssigned) throw createHttpError('You are already assigned to this task', 400);

    if (task.type === 'solo') {
      const assigneeCount = await this.taskAssigneeRepo.countAssignees(taskId);
      if (assigneeCount > 0) throw createHttpError('This is a solo task and someone is already assigned', 400);
    }

    const teamMembers = await this.challengeTeamRepo.findByChallenge(task.challenge_id);
    if (!teamMembers.some(m => m.user_id === userId)) {
      await this.challengeTeamRepo.create({ challenge_id: task.challenge_id, user_id: userId });
      console.log(`[TaskAssignService] User ${userId} added to challenge_team for challenge ${task.challenge_id}`);
    }

    const assignment = await this.taskAssigneeRepo.assignUser(taskId, userId);
    const provisioning = await this.provisionWorkspace(task, taskId, userId);

    return { assignment, provisioning };
  }

  async unassign(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw createHttpError('Task not found', 404);

    const isAssigned = await this.taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (!isAssigned) throw createHttpError('You are not assigned to this task', 400);

    await this.taskAssigneeRepo.unassignUser(taskId, userId);
  }

  private async provisionWorkspace(
    task: NonNullable<Awaited<ReturnType<TaskRepository['findById']>>>,
    taskId: string,
    userId: string
  ): Promise<ProvisioningResult[]> {
    if (!task.repo_id) {
      console.log(`[TaskAssignService] Task "${task.title}" has no repo_id, skipping provisioning`);
      return [];
    }

    const challenge = await this.challengeRepo.findById(task.challenge_id);
    if (!challenge) return [];

    const challengeRepos = await this.challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
    const cr = challengeRepos.find(r => r.repo_id === task.repo_id);
    if (!cr) {
      console.warn(`[TaskAssignService] No matching challenge repo found for task repo_id ${task.repo_id}`);
      return [];
    }

    const kaggleTypes = new Set(
      Object.keys(ConnectorRegistry.REPO_TYPE_TO_GRID).filter(
        type => type.startsWith('kaggle')
      )
    );
    const isKaggle = cr.repo_type !== null && kaggleTypes.has(cr.repo_type);
    if (isKaggle) {
      const existingWorkspace = await this.taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);
      if (!existingWorkspace) {
        await this.taskWorkspaceRepo.create({
          task_id: taskId,
          repo_id: cr.repo_id,
          workspace_provider: 'kaggle',
          workspace_status: 'pending',
          workspace_meta: { type: cr.repo_type },
        });
      }
      console.log(`[TaskAssignService] Kaggle repo ${cr.repo_id} — workspace pending user URL submission`);
      return [{ repo_id: cr.repo_id, status: 'pending_user_submission' }];
    }

    if (!cr.repo_external_id) {
      console.warn(`[TaskAssignService] Repo ${cr.repo_id} (${cr.repo_type}) has no external_repo_id, skipping provisioning`);
      return [];
    }

    // Tâche concurrente GitHub : une branche par utilisateur, stockée comme Kaggle (workspace_meta.userUrls)
    const isConcurrentGitHub = task.type === 'concurrent' && cr.repo_type === 'github';
    if (isConcurrentGitHub) {
      const user = await this.userRepo.findById(userId);
      const userIdentifier = user?.github_username || user?.full_name || userId.substring(0, 8);
      const existingWorkspace = await this.taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);

      try {
        console.log(`[TaskAssignService] Provisioning concurrent GitHub branch for user "${userIdentifier}" on task "${task.title}"`);
        const result = await provisionTaskWorkspace({
          challengeIndex: challenge.index ?? 0,
          taskTitle: task.title,
          repoExternalId: cr.repo_external_id,
          repoType: cr.repo_type,
          challengeBranchRef: cr.workspace_ref,
          userIdentifier,
        });

        const existingMeta = (existingWorkspace?.workspace_meta ?? {}) as Record<string, unknown>;
        const existingUserUrls = (existingMeta.userUrls ?? {}) as Record<string, string>;
        const updatedMeta = {
          ...existingMeta,
          userUrls: { ...existingUserUrls, [userId]: result.url },
        };

        if (existingWorkspace) {
          await this.taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
            workspace_provider: result.provider,
            workspace_status: result.status,
            workspace_meta: updatedMeta,
          });
        } else {
          await this.taskWorkspaceRepo.create({
            task_id: taskId,
            repo_id: cr.repo_id,
            workspace_provider: result.provider,
            workspace_status: result.status,
            workspace_meta: updatedMeta,
          });
        }

        if (result.status === 'ready' && result.ref && user?.github_username) {
          try {
            const workspaceType = mapRepoTypeToWorkspaceType(cr.repo_type);
            const provider = ProvisionerRegistry.getProvider(workspaceType);
            if (provider.protect) {
              await provider.protect(cr.repo_external_id, result.ref, [user.github_username]);
            }
          } catch (protectError) {
            console.warn(`[TaskAssignService] Workspace protection failed for repo ${cr.repo_id}:`, protectError);
          }
        }

        if (result.error) {
          console.warn(`[TaskAssignService] Concurrent GitHub provisioning warning for repo ${cr.repo_id}: ${result.error}`);
        }
        return [{ repo_id: cr.repo_id, status: result.status, result }];

      } catch (provisionError) {
        console.error(`[TaskAssignService] Concurrent GitHub provisioning failed for repo ${cr.repo_id}:`, provisionError);
        const errorMsg = provisionError instanceof Error ? provisionError.message : 'Unknown error';

        const existingMeta = (existingWorkspace?.workspace_meta ?? {}) as Record<string, unknown>;
        if (!existingWorkspace) {
          await this.taskWorkspaceRepo.create({
            task_id: taskId,
            repo_id: cr.repo_id,
            workspace_status: 'failed',
            workspace_meta: { ...existingMeta, error: errorMsg },
          });
        } else {
          await this.taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
            workspace_status: 'failed',
            workspace_meta: { ...existingMeta, error: errorMsg },
          });
        }
        return [{ repo_id: cr.repo_id, status: 'failed', error: errorMsg }];
      }
    }

    const existingWorkspace = await this.taskWorkspaceRepo.findByTaskAndRepo(taskId, cr.repo_id);
    if (existingWorkspace?.workspace_status === 'ready') {
      return [{ repo_id: cr.repo_id, status: 'already_exists', workspace: existingWorkspace }];
    }

    try {
      console.log(`[TaskAssignService] Provisioning workspace for task "${task.title}" on repo ${cr.repo_external_id}`);
      const result = await provisionTaskWorkspace({
        challengeIndex: challenge.index ?? 0,
        taskTitle: task.title,
        repoExternalId: cr.repo_external_id,
        repoType: cr.repo_type,
        challengeBranchRef: cr.workspace_ref,
      });

      if (existingWorkspace) {
        await this.taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
          workspace_provider: result.provider,
          workspace_ref: result.ref,
          workspace_url: result.url,
          workspace_status: result.status,
          workspace_meta: result.meta,
        });
      } else {
        await this.taskWorkspaceRepo.create({
          task_id: taskId,
          repo_id: cr.repo_id,
          workspace_provider: result.provider,
          workspace_ref: result.ref,
          workspace_url: result.url,
          workspace_status: result.status,
          workspace_meta: result.meta,
        });
      }

      if (result.status === 'ready' && result.ref) {
        try {
          const workspaceType = mapRepoTypeToWorkspaceType(cr.repo_type);
          const provider = ProvisionerRegistry.getProvider(workspaceType);
          if (provider.protect) {
            const user = await this.userRepo.findById(userId);
            if (user?.github_username) {
              await provider.protect(cr.repo_external_id, result.ref, [user.github_username]);
            }
          }
        } catch (protectError) {
          console.warn(`[TaskAssignService] Workspace protection failed for repo ${cr.repo_id}:`, protectError);
        }
      }

      if (result.error) {
        console.warn(`[TaskAssignService] Provisioning warning for repo ${cr.repo_id}: ${result.error}`);
      }
      return [{ repo_id: cr.repo_id, status: result.status, result }];

    } catch (provisionError) {
      console.error(`[TaskAssignService] Provisioning failed for repo ${cr.repo_id}:`, provisionError);
      const errorMsg = provisionError instanceof Error ? provisionError.message : 'Unknown error';

      if (!existingWorkspace) {
        await this.taskWorkspaceRepo.create({
          task_id: taskId,
          repo_id: cr.repo_id,
          workspace_status: 'failed',
          workspace_meta: { error: errorMsg },
        });
      } else {
        await this.taskWorkspaceRepo.updateWorkspace(taskId, cr.repo_id, {
          workspace_status: 'failed',
          workspace_meta: { error: errorMsg },
        });
      }
      return [{ repo_id: cr.repo_id, status: 'failed', error: errorMsg }];
    }
  }
}
