import { config } from "../../config/index.js";
import "dotenv/config";
import { pgTable, text, varchar, timestamp, uuid, integer, json, date, serial, real } from "drizzle-orm/pg-core";
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
  completion: real("completion").default(0),
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
  bio: text("bio"),
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
  submitted_at: timestamp("submitted_at").defaultNow().notNull(),
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

// --- DISCORD_ACCOUNTS ---
export const discord_accounts = pgTable("discord_accounts", {
  discord_id: varchar("discord_id", { length: 32 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull(),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "set null" }),
});

// --- DISCORD_CONVERSATIONS ---
export const discord_conversations = pgTable("discord_conversations", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  channel_id: varchar("channel_id", { length: 32 }).notNull(),
  helper_discord_id: varchar("helper_discord_id", { length: 32 }).references(() => discord_accounts.discord_id, { onDelete: "set null" }),
  beneficiary_discord_id: varchar("beneficiary_discord_id", { length: 32 }).references(() => discord_accounts.discord_id, { onDelete: "set null" }),
  start_message_id: uuid("start_message_id"), // référence discord_messages.uuid après insertion
  end_message_id: uuid("end_message_id"),     // null tant que la conversation n'est pas clôturée
  started_at: timestamp("started_at").defaultNow(),
});

// --- DISCORD_MESSAGES ---
export const discord_messages = pgTable("discord_messages", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  discord_message_id: varchar("discord_message_id", { length: 32 }).notNull().unique(), // snowflake Discord
  conversation_id: uuid("conversation_id").references(() => discord_conversations.uuid, { onDelete: "cascade" }),
  author_discord_id: varchar("author_discord_id", { length: 32 }).references(() => discord_accounts.discord_id, { onDelete: "set null" }),
  content: text("content").notNull(),
  sent_at: timestamp("sent_at").notNull(),
});

// --- DISCORD_TRIGGERS ---
export const discord_triggers = pgTable("discord_triggers", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  message_id: uuid("message_id").references(() => discord_messages.uuid, { onDelete: "cascade" }),
  trigger_type: varchar("trigger_type", { length: 20 }).notNull(), // GRATITUDE | HELP_REQUEST
  keyword_detected: varchar("keyword_detected", { length: 255 }).notNull(),
  language: varchar("language", { length: 2 }).notNull(), // FR | EN
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

export const usersRelations = relations(users, ({ many, one }) => ({
  contributions: many(contributions),
  challenge_teams: many(challenge_teams),
  discord_account: one(discord_accounts, {
    fields: [users.uuid],
    references: [discord_accounts.user_id],
  }),
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

export const discordAccountsRelations = relations(discord_accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [discord_accounts.user_id],
    references: [users.uuid],
  }),
  messages: many(discord_messages),
  conversations_as_helper: many(discord_conversations, { relationName: "helper" }),
  conversations_as_beneficiary: many(discord_conversations, { relationName: "beneficiary" }),
}));

export const discordConversationsRelations = relations(discord_conversations, ({ one, many }) => ({
  helper: one(discord_accounts, {
    fields: [discord_conversations.helper_discord_id],
    references: [discord_accounts.discord_id],
    relationName: "helper",
  }),
  beneficiary: one(discord_accounts, {
    fields: [discord_conversations.beneficiary_discord_id],
    references: [discord_accounts.discord_id],
    relationName: "beneficiary",
  }),
  messages: many(discord_messages),
}));

export const discordMessagesRelations = relations(discord_messages, ({ one }) => ({
  conversation: one(discord_conversations, {
    fields: [discord_messages.conversation_id],
    references: [discord_conversations.uuid],
  }),
  author: one(discord_accounts, {
    fields: [discord_messages.author_discord_id],
    references: [discord_accounts.discord_id],
  }),
  trigger: one(discord_triggers, {
    fields: [discord_messages.uuid],
    references: [discord_triggers.message_id],
  }),
}));

export const discordTriggersRelations = relations(discord_triggers, ({ one }) => ({
  message: one(discord_messages, {
    fields: [discord_triggers.message_id],
    references: [discord_messages.uuid],
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
    discord_accounts,
    discord_conversations,
    discord_messages,
    discord_triggers,
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
    discordAccountsRelations,
    discordConversationsRelations,
    discordMessagesRelations,
    discordTriggersRelations,
  },
});
