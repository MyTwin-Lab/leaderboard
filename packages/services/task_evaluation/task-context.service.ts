import {
  ChallengeRepository,
  TaskRepository,
  TaskWorkspaceRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, Task, User, TaskWorkspace, Repo } from "../../database-service/domain/entities.js";
import { RepoRepository } from "../../database-service/repositories/index.js";

/**
 * Informations sur un workspace lié à une task (agnostique du type de connecteur)
 */
export interface TaskWorkspaceInfo {
  repo: Repo;
  branch: string;
  workspaceRef: string;
  workspaceUrl?: string;
}

/**
 * Contexte complet pour évaluer une task
 */
export interface TaskEvaluationContext {
  challenge: Challenge;
  task: Task;
  assignees: User[];
  workspaces: TaskWorkspaceInfo[];
}

/**
 * TaskContextService
 * ------------------
 * Récupère le contexte complet d'une task pour l'évaluation :
 * challenge, task (titre/description), assignés, et branches GitHub.
 */
export class TaskContextService {
  private challengeRepo: ChallengeRepository;
  private taskRepo: TaskRepository;
  private taskWorkspaceRepo: TaskWorkspaceRepository;
  private repoRepo: RepoRepository;

  constructor() {
    this.challengeRepo = new ChallengeRepository();
    this.taskRepo = new TaskRepository();
    this.taskWorkspaceRepo = new TaskWorkspaceRepository();
    this.repoRepo = new RepoRepository();
  }

  /**
   * Récupère le contexte complet d'une task.
   * Pour les tâches concurrentes, userId est utilisé pour résoudre le workspace
   * propre au contributeur (workspace_meta.userUrls[userId]).
   */
  async getTaskContext(taskId: string, userId?: string): Promise<TaskEvaluationContext> {
    // 1. Récupérer la task
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new Error(`[TaskContextService] Task ${taskId} not found`);
    }

    // 2. Récupérer le challenge parent
    const challenge = await this.challengeRepo.findById(task.challenge_id);
    if (!challenge) {
      throw new Error(`[TaskContextService] Challenge ${task.challenge_id} not found for task ${taskId}`);
    }

    // 3. Récupérer les assignés de la task
    const assignees = await this.taskRepo.findAssignees(taskId);

    // 4. Récupérer les workspaces (repos + branches) via task_workspaces
    const taskWorkspaceRows = await this.taskWorkspaceRepo.findByTask(taskId);

    const workspaces: TaskWorkspaceInfo[] = [];
    for (const tw of taskWorkspaceRows) {
      const repo = await this.repoRepo.findById(tw.repo_id);
      if (!repo) {
        console.warn(`[TaskContextService] Repo ${tw.repo_id} not found for task workspace`);
        continue;
      }

      // Pour les repos Kaggle ou GitHub concurrent, résoudre depuis workspace_meta.userUrls[userId]
      const isKaggleRepo = repo.type === 'kaggle_dataset' || repo.type === 'kaggle_model';
      const isConcurrentGitHub = repo.type === 'github' && task.type === 'concurrent';
      let effectiveRepo = repo;
      let effectiveBranch = tw.workspace_ref ? this.extractBranchName(tw.workspace_ref) : '';

      if (isKaggleRepo && userId) {
        const meta = tw.workspace_meta as Record<string, unknown> | null;
        const userUrls = meta?.userUrls as Record<string, string> | undefined;
        const userUrl = userUrls?.[userId];
        if (userUrl) {
          const slug = this.extractSlugFromUrl(userUrl);
          if (slug) {
            effectiveRepo = { ...repo, external_repo_id: slug };
            console.log(`[TaskContextService] Kaggle repo — using slug: ${slug} (from ${userUrl})`);
          } else {
            console.warn(`[TaskContextService] Could not extract slug from user URL: ${userUrl}`);
          }
        } else {
          console.warn(`[TaskContextService] No URL submitted by user ${userId} for Kaggle repo ${repo.title}`);
        }
      } else if (isConcurrentGitHub && userId) {
        const meta = tw.workspace_meta as Record<string, unknown> | null;
        const userUrls = meta?.userUrls as Record<string, string> | undefined;
        const userUrl = userUrls?.[userId];
        if (userUrl) {
          const branch = this.extractBranchFromGitHubUrl(userUrl);
          if (branch) {
            effectiveBranch = branch;
            console.log(`[TaskContextService] Concurrent GitHub — using branch: ${branch} (from ${userUrl})`);
          } else {
            console.warn(`[TaskContextService] Could not extract branch from GitHub URL: ${userUrl}`);
          }
        } else {
          console.warn(`[TaskContextService] No branch URL for user ${userId} in concurrent GitHub task ${repo.title}`);
        }
      }

      workspaces.push({
        repo: effectiveRepo,
        branch: effectiveBranch,
        workspaceRef: tw.workspace_ref ?? '',
        workspaceUrl: tw.workspace_url ?? undefined,
      });
    }

    if (workspaces.length === 0) {
      console.warn(`[TaskContextService] No workspaces found for task ${taskId}`);
    }

    return { challenge, task, assignees, workspaces };
  }

  /**
   * Extrait le nom de branche depuis un workspace_ref
   * Ex: "refs/heads/task/007-setup-environment" → "task/007-setup-environment"
   */
  private extractBranchName(workspaceRef: string): string {
    return workspaceRef.replace(/^refs\/heads\//, '');
  }

  /**
   * Extrait le nom de branche depuis une URL GitHub
   * Ex: "https://github.com/owner/repo/tree/task/007-setup-env-john-doe" → "task/007-setup-env-john-doe"
   */
  private extractBranchFromGitHubUrl(url: string): string {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      // parts = ['owner', 'repo', 'tree', 'task', '007-...']
      const treeIndex = parts.indexOf('tree');
      if (treeIndex !== -1 && treeIndex < parts.length - 1) {
        return parts.slice(treeIndex + 1).join('/');
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Extrait le slug "owner/name" depuis une URL externe.
   * Ex: "https://www.kaggle.com/models/alice/my-model" → "alice/my-model"
   * Ex: "https://huggingface.co/alice/my-model" → "alice/my-model"
   */
  private extractSlugFromUrl(url: string): string | null {
    try {
      const segments = new URL(url).pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
      }
      return null;
    } catch {
      return null;
    }
  }
}
