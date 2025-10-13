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
} from "./drizzle.js";
import type {
  Project,
  Repo,
  Challenge,
  ChallengeRepo,
  ChallengeTeam,
  User,
  Contribution,
} from "../domain/entities.js";

// --- Types inférés depuis Drizzle ---
type DbProject = InferSelectModel<typeof projects>;
type DbRepo = InferSelectModel<typeof repos>;
type DbChallenge = InferSelectModel<typeof challenges>;
type DbChallengeRepo = InferSelectModel<typeof challenge_repos>;
type DbChallengeTeam = InferSelectModel<typeof challenge_teams>;
type DbUser = InferSelectModel<typeof users>;
type DbContribution = InferSelectModel<typeof contributions>;

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
    index: entity.index,
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
