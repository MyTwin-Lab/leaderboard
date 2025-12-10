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
    project_id: row.project_id ?? "",
  };
}

export function toDomainChallengeRepo(row: DbChallengeRepo): ChallengeRepo {
  return {
    challenge_id: row.challenge_id ?? "",
    repo_id: row.repo_id ?? "",
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
    project_id: entity.project_id || null,
  };
}

export function toDbUser(entity: Omit<User, "uuid" | "created_at">): typeof users.$inferInsert {
  return {
    role: entity.role,
    full_name: entity.full_name,
    github_username: entity.github_username,
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
  };
}

export function toDomainRefreshToken(row: DbRefreshToken): RefreshToken {
  return {
    id: row.id,
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
