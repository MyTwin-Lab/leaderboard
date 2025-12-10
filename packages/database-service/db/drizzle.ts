import { config } from "../../config/index.js";
import "dotenv/config";
import { pgTable, text, varchar, timestamp, uuid, integer, json, date, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// --- PROJECTS ---
export const projects = pgTable("projects", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

// --- REPOS ---
export const repos = pgTable("repos", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  external_repo_id: varchar("external_repo_id", { length: 255 }),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
});

// --- CHALLENGES ---
export const challenges = pgTable("challenges", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  index: serial("index"),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 100 }).notNull(),
  start_date: date("start_date"),
  end_date: date("end_date"),
  description: text("description"),
  roadmap: text("roadmap"),
  contribution_points_reward: integer("contribution_points_reward").default(0),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
});

// --- CHALLENGE_REPOS ---
export const challenge_repos = pgTable("challenge_repos", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  repo_id: uuid("repo_id").references(() => repos.uuid, { onDelete: "cascade" }),
});

// --- CHALLENGE_TEAMS ---
export const challenge_teams = pgTable("challenge_teams", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
});

// --- USERS ---
export const users = pgTable("users", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  role: varchar("role", { length: 100 }).notNull(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  github_username: varchar("github_username", { length: 255 }).notNull(),
  password_hash: text("password_hash"),
  created_at: timestamp("created_at").defaultNow(),
});

// --- CONTRIBUTIONS ---
export const contributions = pgTable("contributions", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  description: text("description"),
  evaluation: json("evaluation"),
  tags: json("tags").$type<string[]>(),
  reward: integer("reward").default(0),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
});

// --- TASKS ---
export const tasks = pgTable("tasks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  parent_task_id: uuid("parent_task_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "solo" | "concurrent"
  status: varchar("status", { length: 20 }).notNull().default("todo"), // "todo" | "done"
  created_at: timestamp("created_at").defaultNow(),
});

// --- TASK_ASSIGNEES ---
export const task_assignees = pgTable("task_assignees", {
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  assigned_at: timestamp("assigned_at").defaultNow(),
});

// --- REFRESH_TOKENS ---
export const refresh_tokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.uuid, { onDelete: "cascade" }),
  token_hash: text("token_hash").notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// --- RELATIONS ---

export const projectsRelations = relations(projects, ({ many }) => ({
  repos: many(repos),
  challenges: many(challenges),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  project: one(projects, {
    fields: [repos.project_id],
    references: [projects.uuid],
  }),
  challenge_links: many(challenge_repos),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  project: one(projects, {
    fields: [challenges.project_id],
    references: [projects.uuid],
  }),
  repos: many(challenge_repos),
  team_members: many(challenge_teams),
  contributions: many(contributions),
  tasks: many(tasks),
}));

export const challengeReposRelations = relations(challenge_repos, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challenge_repos.challenge_id],
    references: [challenges.uuid],
  }),
  repo: one(repos, {
    fields: [challenge_repos.repo_id],
    references: [repos.uuid],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  contributions: many(contributions),
  challenge_teams: many(challenge_teams),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  user: one(users, {
    fields: [contributions.user_id],
    references: [users.uuid],
  }),
  challenge: one(challenges, {
    fields: [contributions.challenge_id],
    references: [challenges.uuid],
  }),
}));

export const challengeTeamsRelations = relations(challenge_teams, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challenge_teams.challenge_id],
    references: [challenges.uuid],
  }),
  user: one(users, {
    fields: [challenge_teams.user_id],
    references: [users.uuid],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [tasks.challenge_id],
    references: [challenges.uuid],
  }),
  parent_task: one(tasks, {
    fields: [tasks.parent_task_id],
    references: [tasks.uuid],
    relationName: "task_hierarchy",
  }),
  sub_tasks: many(tasks, { relationName: "task_hierarchy" }),
  assignees: many(task_assignees),
}));

export const taskAssigneesRelations = relations(task_assignees, ({ one }) => ({
  task: one(tasks, {
    fields: [task_assignees.task_id],
    references: [tasks.uuid],
  }),
  user: one(users, {
    fields: [task_assignees.user_id],
    references: [users.uuid],
  }),
}));

export const refreshTokensRelations = relations(refresh_tokens, ({ one }) => ({
  user: one(users, {
    fields: [refresh_tokens.user_id],
    references: [users.uuid],
  }),
}));

// --- DATABASE CLIENT ---

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, {
  schema: {
    projects,
    repos,
    challenges,
    challenge_repos,
    challenge_teams,
    users,
    contributions,
    tasks,
    task_assignees,
    refresh_tokens,
    projectsRelations,
    reposRelations,
    challengesRelations,
    challengeReposRelations,
    challengeTeamsRelations,
    usersRelations,
    contributionsRelations,
    tasksRelations,
    taskAssigneesRelations,
    refreshTokensRelations,
  },
});