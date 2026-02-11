/* ============================================================
 *  DB MAPPERS — MyTwin Leaderboard
 *  Convertit les rows Drizzle → Domain Entities
 * ============================================================ */

import type { InferSelectModel } from "drizzle-orm";
import {
  projects,
  repos,
  challenges,
  challenge_repos,
  challenge_teams,
  users,
  contributions,
  refresh_tokens,
  tasks,
  task_assignees,
  task_workspaces,
  evaluation_runs,
  evaluation_run_contributions,
  evaluation_grids,
  evaluation_grid_categories,
  evaluation_grid_subcriteria,
} from "./drizzle.js";
import type {
  Project,
  Repo,
  Challenge,
  ChallengeRepo,
  ChallengeTeam,
  User,
  Contribution,
  RefreshToken,
  Task,
  TaskAssignee,
  TaskWorkspace,
  WorkspaceStatus,
  WorkspaceMeta,
  EvaluationRun,
  EvaluationRunContribution,
  EvaluationRunTriggerType,
  EvaluationRunStatus,
  EvaluationRunContributionStatus,
  EvaluationGrid,
  EvaluationGridCategory,
  EvaluationGridSubcriterion,
  EvaluationGridStatus,
  EvaluationGridCategoryType,
} from "../domain/entities.js";

// --- Types inférés depuis Drizzle ---
type DbProject = InferSelectModel<typeof projects>;
type DbRepo = InferSelectModel<typeof repos>;
type DbChallenge = InferSelectModel<typeof challenges>;
type DbChallengeRepo = InferSelectModel<typeof challenge_repos>;
type DbChallengeTeam = InferSelectModel<typeof challenge_teams>;
type DbUser = InferSelectModel<typeof users>;
type DbContribution = InferSelectModel<typeof contributions>;
type DbRefreshToken = InferSelectModel<typeof refresh_tokens>;
type DbTask = InferSelectModel<typeof tasks>;
type DbTaskAssignee = InferSelectModel<typeof task_assignees>;
type DbTaskWorkspace = InferSelectModel<typeof task_workspaces>;
type DbEvaluationRun = InferSelectModel<typeof evaluation_runs>;
type DbEvaluationRunContribution = InferSelectModel<typeof evaluation_run_contributions>;
type DbEvaluationGrid = InferSelectModel<typeof evaluation_grids>;
type DbEvaluationGridCategory = InferSelectModel<typeof evaluation_grid_categories>;
type DbEvaluationGridSubcriterion = InferSelectModel<typeof evaluation_grid_subcriteria>;

/* ============================================================
 *  MAPPERS DB → DOMAIN
 * ============================================================ */

export function toDomainProject(row: DbProject): Project {
  return {
    uuid: row.uuid,
    title: row.title,
    description: row.description ?? "",
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDomainRepo(row: DbRepo): Repo {
  return {
    uuid: row.uuid,
    title: row.title,
    type: row.type,
    external_repo_id: row.external_repo_id ?? undefined,
    project_id: row.project_id ?? "",
  };
}

export function toDomainChallenge(row: DbChallenge): Challenge {
  return {
    uuid: row.uuid,
    index: row.index,
    title: row.title,
    status: row.status,
    start_date: row.start_date ? new Date(row.start_date) : new Date(),
    end_date: row.end_date ? new Date(row.end_date) : new Date(),
    description: row.description ?? "",
    roadmap: row.roadmap ?? "",
    contribution_points_reward: row.contribution_points_reward ?? 0,
    completion: row.completion ?? 0,
    project_id: row.project_id ?? "",
  };
}

export function toDomainChallengeRepo(row: DbChallengeRepo): ChallengeRepo {
  return {
    challenge_id: row.challenge_id ?? "",
    repo_id: row.repo_id ?? "",
    workspace_provider: row.workspace_provider ?? undefined,
    workspace_ref: row.workspace_ref ?? undefined,
    workspace_url: row.workspace_url ?? undefined,
    workspace_status: (row.workspace_status as WorkspaceStatus) ?? undefined,
    workspace_meta: (row.workspace_meta as WorkspaceMeta) ?? undefined,
  };
}

export function toDomainChallengeTeam(row: DbChallengeTeam): ChallengeTeam {
  return {
    challenge_id: row.challenge_id ?? "",
    user_id: row.user_id ?? "",
  };
}

export function toDomainUser(row: DbUser): User {
  return {
    uuid: row.uuid,
    role: row.role,
    full_name: row.full_name,
    github_username: row.github_username,
    bio: row.bio ?? undefined,
    password_hash: row.password_hash ?? undefined,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDomainContribution(row: DbContribution): Contribution {
  return {
    uuid: row.uuid,
    title: row.title,
    type: row.type,
    description: row.description ?? "",
    evaluation: row.evaluation ?? null,
    tags: (row.tags as string[]) ?? [],
    reward: row.reward ?? 0,
    user_id: row.user_id ?? "",
    challenge_id: row.challenge_id ?? "",
    submitted_at: new Date(row.submitted_at),
  };
}

/* ============================================================
 *  MAPPERS DOMAIN → DB (pour insert/update)
 * ============================================================ */

export function toDbProject(entity: Omit<Project, "uuid" | "created_at">): typeof projects.$inferInsert {
  return {
    title: entity.title,
    description: entity.description || null,
  };
}

export function toDbRepo(entity: Omit<Repo, "uuid">): typeof repos.$inferInsert {
  return {
    title: entity.title,
    type: entity.type,
    external_repo_id: entity.external_repo_id ?? null,
    project_id: entity.project_id || null,
  };
}

export function toDbChallenge(entity: Omit<Challenge, "uuid">): typeof challenges.$inferInsert {
  return {
    // index est auto-généré par PostgreSQL (serial)
    title: entity.title,
    status: entity.status,
    start_date: entity.start_date.toISOString().split("T")[0], // YYYY-MM-DD
    end_date: entity.end_date.toISOString().split("T")[0],
    description: entity.description || null,
    roadmap: entity.roadmap || null,
    contribution_points_reward: entity.contribution_points_reward,
    completion: entity.completion ?? 0,
    project_id: entity.project_id || null,
  };
}

export function toDbUser(entity: Omit<User, "uuid" | "created_at">): typeof users.$inferInsert {
  return {
    role: entity.role,
    full_name: entity.full_name,
    github_username: entity.github_username,
    bio: entity.bio ?? null,
    password_hash: entity.password_hash ?? null,
  };
}

export function toDbContribution(entity: Omit<Contribution, "uuid">): typeof contributions.$inferInsert {
  return {
    title: entity.title,
    type: entity.type,
    description: entity.description || null,
    evaluation: entity.evaluation ?? null,
    tags: entity.tags && entity.tags.length > 0 ? entity.tags : null,
    reward: entity.reward,
    user_id: entity.user_id || null,
    challenge_id: entity.challenge_id || null,
    submitted_at: entity.submitted_at,
  };
}

export function toDomainRefreshToken(row: DbRefreshToken): RefreshToken {
  return {
    id: row.uuid,
    user_id: row.user_id,
    token_hash: row.token_hash,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbRefreshToken(entity: Omit<RefreshToken, "id" | "created_at">): typeof refresh_tokens.$inferInsert {
  return {
    user_id: entity.user_id,
    token_hash: entity.token_hash,
    expires_at: entity.expires_at,
  };
}

export function toDomainTask(row: DbTask): Task {
  return {
    uuid: row.uuid,
    challenge_id: row.challenge_id ?? "",
    parent_task_id: row.parent_task_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    type: row.type as "solo" | "concurrent",
    status: (row.status as "todo" | "done") ?? "todo",
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbTask(entity: Omit<Task, "uuid" | "created_at">): typeof tasks.$inferInsert {
  return {
    challenge_id: entity.challenge_id || null,
    parent_task_id: entity.parent_task_id || null,
    title: entity.title,
    description: entity.description || null,
    type: entity.type,
    status: entity.status,
  };
}

export function toDomainTaskAssignee(row: DbTaskAssignee): TaskAssignee {
  return {
    task_id: row.task_id ?? "",
    user_id: row.user_id ?? "",
    assigned_at: new Date(row.assigned_at ?? Date.now()),
  };
}

export function toDbTaskAssignee(entity: Omit<TaskAssignee, "assigned_at">): typeof task_assignees.$inferInsert {
  return {
    task_id: entity.task_id,
    user_id: entity.user_id,
  };
}

export function toDomainTaskWorkspace(row: DbTaskWorkspace): TaskWorkspace {
  return {
    task_id: row.task_id ?? "",
    repo_id: row.repo_id ?? "",
    workspace_provider: row.workspace_provider ?? undefined,
    workspace_ref: row.workspace_ref ?? undefined,
    workspace_url: row.workspace_url ?? undefined,
    workspace_status: (row.workspace_status as WorkspaceStatus) ?? undefined,
    workspace_meta: (row.workspace_meta as WorkspaceMeta) ?? undefined,
  };
}

export function toDbTaskWorkspace(entity: TaskWorkspace): typeof task_workspaces.$inferInsert {
  return {
    task_id: entity.task_id,
    repo_id: entity.repo_id,
    workspace_provider: entity.workspace_provider ?? null,
    workspace_ref: entity.workspace_ref ?? null,
    workspace_url: entity.workspace_url ?? null,
    workspace_status: entity.workspace_status ?? null,
    workspace_meta: entity.workspace_meta ?? null,
  };
}

/* ============================================================
 *  EVALUATION RUNS MAPPERS
 * ============================================================ */

export function toDomainEvaluationRun(row: DbEvaluationRun): EvaluationRun {
  return {
    uuid: row.uuid,
    challenge_id: row.challengeId,
    trigger_type: row.triggerType as EvaluationRunTriggerType,
    trigger_payload: (row.triggerPayload as Record<string, unknown>) ?? undefined,
    window_start: new Date(row.windowStart),
    window_end: new Date(row.windowEnd),
    status: row.status as EvaluationRunStatus,
    started_at: row.startedAt ? new Date(row.startedAt) : undefined,
    finished_at: row.finishedAt ? new Date(row.finishedAt) : undefined,
    error_code: row.errorCode ?? undefined,
    error_message: row.errorMessage ?? undefined,
    created_by: row.createdBy ?? undefined,
    meta: (row.meta as EvaluationRun['meta']) ?? undefined,
  };
}

export function toDbEvaluationRun(
  entity: Omit<EvaluationRun, 'uuid'>
): typeof evaluation_runs.$inferInsert {
  return {
    challengeId: entity.challenge_id,
    triggerType: entity.trigger_type,
    triggerPayload: entity.trigger_payload ?? null,
    windowStart: entity.window_start,
    windowEnd: entity.window_end,
    status: entity.status,
    startedAt: entity.started_at ?? null,
    finishedAt: entity.finished_at ?? null,
    errorCode: entity.error_code ?? null,
    errorMessage: entity.error_message ?? null,
    createdBy: entity.created_by ?? null,
    meta: entity.meta ?? null,
  };
}

/* ============================================================
 *  EVALUATION RUN CONTRIBUTIONS MAPPERS
 * ============================================================ */

export function toDomainEvaluationRunContribution(row: DbEvaluationRunContribution): EvaluationRunContribution {
  return {
    uuid: row.uuid,
    run_id: row.runId,
    contribution_id: row.contributionId,
    status: row.status as EvaluationRunContributionStatus,
    notes: (row.notes as EvaluationRunContribution['notes']) ?? undefined,
    created_at: new Date(row.createdAt ?? Date.now()),
  };
}

export function toDbEvaluationRunContribution(
  entity: Omit<EvaluationRunContribution, 'uuid' | 'created_at'>
): typeof evaluation_run_contributions.$inferInsert {
  return {
    runId: entity.run_id,
    contributionId: entity.contribution_id,
    status: entity.status,
    notes: entity.notes ?? null,
  };
}

/* ============================================================
 *  EVALUATION GRIDS MAPPERS
 * ============================================================ */

export function toDomainEvaluationGrid(row: DbEvaluationGrid): EvaluationGrid {
  return {
    uuid: row.uuid,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    version: row.version,
    status: row.status as EvaluationGridStatus,
    instructions: row.instructions ?? undefined,
    created_at: new Date(row.created_at ?? Date.now()),
    updated_at: new Date(row.updated_at ?? Date.now()),
    published_at: row.published_at ? new Date(row.published_at) : undefined,
    created_by: row.created_by ?? undefined,
  };
}

export function toDbEvaluationGrid(
  entity: Omit<EvaluationGrid, 'uuid' | 'created_at' | 'updated_at'>
): typeof evaluation_grids.$inferInsert {
  return {
    slug: entity.slug,
    name: entity.name,
    description: entity.description ?? null,
    version: entity.version,
    status: entity.status,
    instructions: entity.instructions ?? null,
    published_at: entity.published_at ?? null,
    created_by: entity.created_by ?? null,
  };
}

export function toDomainEvaluationGridCategory(row: DbEvaluationGridCategory): EvaluationGridCategory {
  return {
    uuid: row.uuid,
    grid_id: row.grid_id,
    name: row.name,
    weight: row.weight,
    type: row.type as EvaluationGridCategoryType,
    position: row.position,
  };
}

export function toDbEvaluationGridCategory(
  entity: Omit<EvaluationGridCategory, 'uuid'>
): typeof evaluation_grid_categories.$inferInsert {
  return {
    grid_id: entity.grid_id,
    name: entity.name,
    weight: entity.weight,
    type: entity.type,
    position: entity.position,
  };
}

export function toDomainEvaluationGridSubcriterion(row: DbEvaluationGridSubcriterion): EvaluationGridSubcriterion {
  return {
    uuid: row.uuid,
    category_id: row.category_id,
    criterion: row.criterion,
    description: row.description ?? undefined,
    weight: row.weight ?? undefined,
    metrics: (row.metrics as string[]) ?? undefined,
    indicators: (row.indicators as string[]) ?? undefined,
    scoring_excellent: row.scoring_excellent ?? undefined,
    scoring_good: row.scoring_good ?? undefined,
    scoring_average: row.scoring_average ?? undefined,
    scoring_poor: row.scoring_poor ?? undefined,
    position: row.position,
  };
}

export function toDbEvaluationGridSubcriterion(
  entity: Omit<EvaluationGridSubcriterion, 'uuid'>
): typeof evaluation_grid_subcriteria.$inferInsert {
  return {
    category_id: entity.category_id,
    criterion: entity.criterion,
    description: entity.description ?? null,
    weight: entity.weight ?? null,
    metrics: entity.metrics ?? null,
    indicators: entity.indicators ?? null,
    scoring_excellent: entity.scoring_excellent ?? null,
    scoring_good: entity.scoring_good ?? null,
    scoring_average: entity.scoring_average ?? null,
    scoring_poor: entity.scoring_poor ?? null,
    position: entity.position,
  };
}
