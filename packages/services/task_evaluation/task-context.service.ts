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
   * Récupère le contexte complet d'une task
   */
  async getTaskContext(taskId: string): Promise<TaskEvaluationContext> {
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
      if (!tw.workspace_ref) continue;

      const repo = await this.repoRepo.findById(tw.repo_id);
      if (!repo) {
        console.warn(`[TaskContextService] Repo ${tw.repo_id} not found for task workspace`);
        continue;
      }

      const branch = this.extractBranchName(tw.workspace_ref);
      workspaces.push({
        repo,
        branch,
        workspaceRef: tw.workspace_ref,
        workspaceUrl: tw.workspace_url,
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
}
