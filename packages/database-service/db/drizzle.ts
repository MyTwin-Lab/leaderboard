import { config } from "../../config/index.js";
import "dotenv/config";
import { pgTable, text, varchar, timestamp, uuid, integer, json, date, serial, real, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// --- PROJECTS ---
export const projects = pgTable("projects", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
  manager_id: uuid("manager_id").references(() => users.uuid, { onDelete: "set null" }),
});

// --- REPOS ---
export const repos = pgTable("repos", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  external_repo_id: varchar("external_repo_id", { length: 255 }),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
}, (table) => ({
  projectIdIdx: index("idx_repos_project_id").on(table.project_id),
  externalRepoIdIdx: index("idx_repos_external_repo_id").on(table.external_repo_id),
}));

// --- CHALLENGES ---
export const challenges = pgTable("challenges", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  index: serial("index"),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).default("code"), // 'code' | 'ml' | ...
  start_date: date("start_date"),
  end_date: date("end_date"),
  description: text("description"),
  roadmap: text("roadmap"),
  contribution_points_reward: integer("contribution_points_reward").default(0),
  completion: real("completion").default(0),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
}, (table) => ({
  projectIdIdx: index("idx_challenges_project_id").on(table.project_id),
  statusIdx: index("idx_challenges_status").on(table.status),
}));

// --- CHALLENGE_REPOS ---
export const challenge_repos = pgTable("challenge_repos", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  repo_id: uuid("repo_id").references(() => repos.uuid, { onDelete: "cascade" }),
  // Workspace provisioning fields
  workspace_provider: varchar("workspace_provider", { length: 32 }), // github, huggingface, figma...
  workspace_ref: varchar("workspace_ref", { length: 200 }), // ex: refs/heads/challenge/007-admin-experience
  workspace_url: text("workspace_url"), // ex: https://github.com/owner/repo/tree/challenge/007
  workspace_status: varchar("workspace_status", { length: 20 }).default("pending"), // pending | ready | failed
  workspace_meta: json("workspace_meta"), // { baseBranch, createdAt, error, sha... }
}, (table) => ({
  challengeIdIdx: index("idx_challenge_repos_challenge_id").on(table.challenge_id),
  repoIdIdx: index("idx_challenge_repos_repo_id").on(table.repo_id),
  compositeIdx: index("idx_challenge_repos_composite").on(table.challenge_id, table.repo_id),
}));

// --- CHALLENGE_TEAMS ---
export const challenge_teams = pgTable("challenge_teams", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
}, (table) => ({
  challengeIdIdx: index("idx_challenge_teams_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_challenge_teams_user_id").on(table.user_id),
  compositeIdx: index("idx_challenge_teams_composite").on(table.challenge_id, table.user_id),
}));

// --- USERS ---
export const users = pgTable("users", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  role: varchar("role", { length: 100 }).notNull(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  github_username: varchar("github_username", { length: 255 }),
  email: varchar("email", { length: 255 }),
  google_user_id: varchar("google_user_id", { length: 255 }),
  bio: text("bio"),
  avatar_url: text("avatar_url"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  githubUsernameIdx: uniqueIndex("idx_users_github_username").on(table.github_username),
  emailIdx: uniqueIndex("idx_users_email").on(table.email),
  googleUserIdIdx: uniqueIndex("idx_users_google_user_id").on(table.google_user_id),
}));

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
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "set null" }),
  submitted_at: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdIdx: index("idx_contributions_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_contributions_user_id").on(table.user_id),
  taskIdIdx: index("idx_contributions_task_id").on(table.task_id),
}));

// --- TASKS ---
export const tasks = pgTable("tasks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  repo_id: uuid("repo_id").references(() => repos.uuid, { onDelete: "set null" }),
  parent_task_id: uuid("parent_task_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "solo" | "concurrent"
  status: varchar("status", { length: 20 }).notNull().default("todo"), // "todo" | "done"
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_tasks_challenge_id").on(table.challenge_id),
  repoIdIdx: index("idx_tasks_repo_id").on(table.repo_id),
  parentTaskIdIdx: index("idx_tasks_parent_task_id").on(table.parent_task_id),
  challengeStatusIdx: index("idx_tasks_challenge_status").on(table.challenge_id, table.status),
}));

// --- TASK_ASSIGNEES ---
export const task_assignees = pgTable("task_assignees", {
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  assigned_at: timestamp("assigned_at").defaultNow(),
}, (table) => ({
  taskIdIdx: index("idx_task_assignees_task_id").on(table.task_id),
  userIdIdx: index("idx_task_assignees_user_id").on(table.user_id),
  compositeIdx: index("idx_task_assignees_composite").on(table.task_id, table.user_id),
}));

// --- TASK_WORKSPACES ---
export const task_workspaces = pgTable("task_workspaces", {
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "cascade" }),
  repo_id: uuid("repo_id").references(() => repos.uuid, { onDelete: "cascade" }),
  // Workspace provisioning fields
  workspace_provider: varchar("workspace_provider", { length: 32 }), // github, huggingface, figma...
  workspace_ref: varchar("workspace_ref", { length: 200 }), // ex: refs/heads/task/007-setup-environment
  workspace_url: text("workspace_url"), // ex: https://github.com/owner/repo/tree/task/007-setup
  workspace_status: varchar("workspace_status", { length: 20 }).default("pending"), // pending | ready | failed
  workspace_meta: json("workspace_meta"), // { baseBranch, createdAt, error, sha... }
}, (table) => ({
  taskIdIdx: index("idx_task_workspaces_task_id").on(table.task_id),
  repoIdIdx: index("idx_task_workspaces_repo_id").on(table.repo_id),
  compositeIdx: index("idx_task_workspaces_composite").on(table.task_id, table.repo_id),
}));

// --- REFRESH_TOKENS ---
export const refresh_tokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.uuid, { onDelete: "cascade" }),
  token_hash: text("token_hash").notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_refresh_tokens_user_id").on(table.user_id),
  expiresAtIdx: index("idx_refresh_tokens_expires_at").on(table.expires_at),
}));

// --- EVALUATION RUN ---
export const evaluation_runs = pgTable('evaluation_runs', {
  uuid: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.uuid, { onDelete: 'cascade' }),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'manual' | 'sync' | 'github_pr'
  triggerPayload: json('trigger_payload'), // exemple: { prNumber, mergedBy }
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // pending | running | succeeded | failed | canceled
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  createdBy: uuid('created_by').references(() => users.uuid),
  meta: json('meta') // { contributionCount, durationMs, evaluatorVersion }
}, (table) => ({
  challengeIdIdx: index('idx_evaluation_runs_challenge_id').on(table.challengeId),
  statusIdx: index('idx_evaluation_runs_status').on(table.status),
  challengeStatusIdx: index('idx_evaluation_runs_challenge_status').on(table.challengeId, table.status),
  startedAtIdx: index('idx_evaluation_runs_started_at').on(table.startedAt),
}));

// --- EVALUATION RUN CONTRIBUTION ---
export const evaluation_run_contributions = pgTable('evaluation_run_contributions', {
  uuid: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => evaluation_runs.uuid, { onDelete: 'cascade' }),
  contributionId: uuid('contribution_id')
    .notNull()
    .references(() => contributions.uuid, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull(), // identified | merged | evaluated | skipped
  notes: json('notes'), // raison skip, warnings evaluator
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  runIdIdx: index('idx_eval_run_contributions_run_id').on(table.runId),
  contributionIdIdx: index('idx_eval_run_contributions_contribution_id').on(table.contributionId),
  runStatusIdx: index('idx_eval_run_contributions_run_status').on(table.runId, table.status),
}));

// --- EVALUATION GRIDS ---
export const evaluation_grids = pgTable('evaluation_grids', {
  uuid: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(), // ex: "code", "model", "dataset"
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | published | archived
  instructions: text('instructions'), // Instructions pour l'agent IA
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  published_at: timestamp('published_at'),
  created_by: uuid('created_by').references(() => users.uuid),
}, (table) => ({
  statusIdx: index('idx_evaluation_grids_status').on(table.status),
  updatedAtIdx: index('idx_evaluation_grids_updated_at').on(table.updated_at),
  slugStatusIdx: index('idx_evaluation_grids_slug_status').on(table.slug, table.status),
}));

export const evaluation_grid_categories = pgTable('evaluation_grid_categories', {
  uuid: uuid('id').primaryKey().defaultRandom(),
  grid_id: uuid('grid_id')
    .notNull()
    .references(() => evaluation_grids.uuid, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(), // ex: "Qualité technique mesurable"
  weight: real('weight').notNull(), // ex: 0.25
  type: varchar('type', { length: 20 }).notNull(), // objective | mixed | subjective | contextual
  position: integer('position').notNull().default(0),
}, (table) => ({
  gridIdIdx: index('idx_evaluation_grid_categories_grid_id').on(table.grid_id),
  positionIdx: index('idx_evaluation_grid_categories_position').on(table.grid_id, table.position),
}));

export const evaluation_grid_subcriteria = pgTable('evaluation_grid_subcriteria', {
  uuid: uuid('id').primaryKey().defaultRandom(),
  category_id: uuid('category_id')
    .notNull()
    .references(() => evaluation_grid_categories.uuid, { onDelete: 'cascade' }),
  criterion: varchar('criterion', { length: 120 }).notNull(), // ex: "Complexité du code"
  description: text('description'),
  weight: real('weight'), // Poids optionnel au sein de la catégorie
  metrics: json('metrics'), // string[] - métriques mesurables
  indicators: json('indicators'), // string[] - indicateurs qualitatifs
  scoring_excellent: text('scoring_excellent'), // Guide: 8-9
  scoring_good: text('scoring_good'), // Guide: 5-7
  scoring_average: text('scoring_average'), // Guide: 2-4
  scoring_poor: text('scoring_poor'), // Guide: 0-1
  position: integer('position').notNull().default(0),
}, (table) => ({
  categoryIdIdx: index('idx_evaluation_grid_subcriteria_category_id').on(table.category_id),
  positionIdx: index('idx_evaluation_grid_subcriteria_position').on(table.category_id, table.position),
}));

// --- CHALLENGE DOCUMENTS ---
export const challenge_documents = pgTable("challenge_documents", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").notNull().references(() => challenges.uuid, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  content: text("content").notNull(),
  uploaded_by: uuid("uploaded_by").references(() => users.uuid, { onDelete: "set null" }),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_challenge_documents_challenge_id").on(table.challenge_id),
}));

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
  documents: many(challenge_documents),
}));

export const challengeDocumentsRelations = relations(challenge_documents, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challenge_documents.challenge_id],
    references: [challenges.uuid],
  }),
  uploaded_by_user: one(users, {
    fields: [challenge_documents.uploaded_by],
    references: [users.uuid],
  }),
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
  task: one(tasks, {
    fields: [contributions.task_id],
    references: [tasks.uuid],
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
  repo: one(repos, {
    fields: [tasks.repo_id],
    references: [repos.uuid],
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

export const evaluationGridsRelations = relations(evaluation_grids, ({ one, many }) => ({
  categories: many(evaluation_grid_categories),
  created_by_user: one(users, {
    fields: [evaluation_grids.created_by],
    references: [users.uuid],
  }),
}));

export const evaluationGridCategoriesRelations = relations(evaluation_grid_categories, ({ one, many }) => ({
  grid: one(evaluation_grids, {
    fields: [evaluation_grid_categories.grid_id],
    references: [evaluation_grids.uuid],
  }),
  subcriteria: many(evaluation_grid_subcriteria),
}));

export const evaluationGridSubcriteriaRelations = relations(evaluation_grid_subcriteria, ({ one }) => ({
  category: one(evaluation_grid_categories, {
    fields: [evaluation_grid_subcriteria.category_id],
    references: [evaluation_grid_categories.uuid],
  }),
}));

export const taskWorkspacesRelations = relations(task_workspaces, ({ one }) => ({
  task: one(tasks, {
    fields: [task_workspaces.task_id],
    references: [tasks.uuid],
  }),
  repo: one(repos, {
    fields: [task_workspaces.repo_id],
    references: [repos.uuid],
  }),
}));

// --- ONBOARDING PROGRESS ---
export const onboarding_progress = pgTable("onboarding_progress", {
  user_id: uuid("user_id").primaryKey().references(() => users.uuid, { onDelete: "cascade" }),
  clicked_challenge: boolean("clicked_challenge").default(false).notNull(),
  assigned_task: boolean("assigned_task").default(false).notNull(),
  evaluated_contribution: boolean("evaluated_contribution").default(false).notNull(),
  validated_task: boolean("validated_task").default(false).notNull(),
  joined_meeting: boolean("joined_meeting").default(false).notNull(),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// --- APP SETTINGS (singleton) ---
export const app_settings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  theme_key: varchar("theme_key", { length: 64 }).notNull().default("default"),
  primary_color: varchar("primary_color", { length: 7 }),   // custom hex e.g. "#0af7c1"
  background_color: varchar("background_color", { length: 7 }), // custom hex e.g. "#0a0a0a"
  theme_mode: varchar("theme_mode", { length: 10 }).notNull().default("dark"), // "dark" | "light"
  updated_at: timestamp("updated_at").defaultNow(),
  updated_by: uuid("updated_by").references(() => users.uuid),
  // GitHub OAuth connection
  github_token_enc: text("github_token_enc"),
  github_token_iv: varchar("github_token_iv", { length: 64 }),
  github_org: varchar("github_org", { length: 255 }),
  github_connected_at: timestamp("github_connected_at"),
  github_connected_by: uuid("github_connected_by").references(() => users.uuid),
});

// --- SYNC MEETINGS ---
export const sync_meetings = pgTable("sync_meetings", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  challenge_id: uuid("challenge_id").notNull().references(() => challenges.uuid, { onDelete: "cascade" }),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time").notNull(),
  meet_link: text("meet_link"),
  calendar_event_id: varchar("calendar_event_id", { length: 255 }),
  conference_id: varchar("conference_id", { length: 255 }),
  conference_record_id: varchar("conference_record_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  created_by: uuid("created_by").notNull().references(() => users.uuid),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_sync_meetings_challenge_id").on(table.challenge_id),
  statusIdx: index("idx_sync_meetings_status").on(table.status),
  endTimeIdx: index("idx_sync_meetings_end_time").on(table.end_time),
  endTimeStatusIdx: index("idx_sync_meetings_end_time_status").on(table.end_time, table.status),
  createdByIdx: index("idx_sync_meetings_created_by").on(table.created_by),
  conferenceRecordIdIdx: index("idx_sync_meetings_conference_record_id").on(table.conference_record_id),
}));

// --- MEETING PARTICIPANTS ---
export const meeting_participants = pgTable("meeting_participants", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  sync_meeting_id: uuid("sync_meeting_id").notNull().references(() => sync_meetings.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "set null" }),
  google_user_id: varchar("google_user_id", { length: 255 }).notNull(),
  display_name: varchar("display_name", { length: 255 }).notNull(),
}, (table) => ({
  meetingIdIdx: index("idx_meeting_participants_meeting_id").on(table.sync_meeting_id),
  userIdIdx: index("idx_meeting_participants_user_id").on(table.user_id),
  googleUserIdIdx: index("idx_meeting_participants_google_user_id").on(table.google_user_id),
}));

// --- MEETING ANALYSES ---
export const meeting_analyses = pgTable("meeting_analyses", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  sync_meeting_id: uuid("sync_meeting_id").notNull().references(() => sync_meetings.uuid, { onDelete: "cascade" }),
  summary: text("summary"),
  decisions: json("decisions").$type<any[]>(),
  actions: json("actions").$type<any[]>(),
  contribution_signals: json("contribution_signals").$type<any[]>(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  processed_at: timestamp("processed_at"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  meetingIdIdx: index("idx_meeting_analyses_meeting_id").on(table.sync_meeting_id),
  statusIdx: index("idx_meeting_analyses_status").on(table.status),
}));

export const syncMeetingsRelations = relations(sync_meetings, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [sync_meetings.challenge_id],
    references: [challenges.uuid],
  }),
  created_by_user: one(users, {
    fields: [sync_meetings.created_by],
    references: [users.uuid],
  }),
  participants: many(meeting_participants),
  analysis: one(meeting_analyses),
}));

export const meetingParticipantsRelations = relations(meeting_participants, ({ one }) => ({
  meeting: one(sync_meetings, {
    fields: [meeting_participants.sync_meeting_id],
    references: [sync_meetings.uuid],
  }),
  user: one(users, {
    fields: [meeting_participants.user_id],
    references: [users.uuid],
  }),
}));

export const meetingAnalysesRelations = relations(meeting_analyses, ({ one }) => ({
  meeting: one(sync_meetings, {
    fields: [meeting_analyses.sync_meeting_id],
    references: [sync_meetings.uuid],
  }),
}));

export const onboardingProgressRelations = relations(onboarding_progress, ({ one }) => ({
  user: one(users, {
    fields: [onboarding_progress.user_id],
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
    evaluation_runs,
    evaluation_run_contributions,
    evaluation_grids,
    evaluation_grid_categories,
    evaluation_grid_subcriteria,
    task_workspaces,
    sync_meetings,
    meeting_participants,
    meeting_analyses,
    projectsRelations,
    reposRelations,
    challenge_documents,
  challengeDocumentsRelations,
  challengesRelations,
    challengeReposRelations,
    challengeTeamsRelations,
    usersRelations,
    contributionsRelations,
    tasksRelations,
    taskAssigneesRelations,
    refreshTokensRelations,
    evaluationGridsRelations,
    evaluationGridCategoriesRelations,
    evaluationGridSubcriteriaRelations,
    taskWorkspacesRelations,
    syncMeetingsRelations,
    meetingParticipantsRelations,
    meetingAnalysesRelations,
    onboardingProgressRelations,
    app_settings,
  },
});