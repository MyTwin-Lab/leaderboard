import { config } from "../../config/index.js";
import "dotenv/config";
import { pgTable, text, varchar, timestamp, uuid, integer, json, jsonb, date, serial, real, index, uniqueIndex, boolean, customType, primaryKey } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Drizzle has no built-in bytea column type — raw binary content (validation
// run files/responses) is stored via this custom type instead of base64 text.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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
  type: varchar("type", { length: 50 }).default("code"), // 'code' | 'ml' | 'validation'
  start_date: date("start_date"),
  end_date: date("end_date"),
  description: text("description"),
  roadmap: text("roadmap"),
  contribution_points_reward: integer("contribution_points_reward").default(0),
  completion: real("completion").default(0),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
  reward_rules: json("reward_rules"), // ML challenges only — see domain/mlRewardRules.ts
  // Validation challenges only: the ML challenge this one validates. 1:1,
  // enforced at the service layer (a source challenge can back at most one).
  source_challenge_id: uuid("source_challenge_id").references((): AnyPgColumn => challenges.uuid, { onDelete: "cascade" }),
  // Validation challenges only: fixed CP a validator earns per first-time
  // (validator, target) validation. Locked after creation.
  cp_per_validation: integer("cp_per_validation"),
  // Validation challenges only: how many verdicts a target must collect
  // before it resolves. Must be odd (enforced at creation) so a majority
  // always exists. Locked after creation, like cp_per_validation.
  required_validations: integer("required_validations"),
  // ML challenges only — activates GPU compute requests (Scaleway) on this
  // specific challenge, on top of the global Scaleway connection.
  compute_enabled: boolean("compute_enabled").notNull().default(false),
  // Code challenges only — d'où vient le livrable évalué :
  // 'provided_repo' = repo GitHub du challenge, branche perso par contributeur
  // 'own_repo'      = chaque contributeur fournit l'URL de son propre repo
  workspace_mode: varchar("workspace_mode", { length: 20 }).default("provided_repo"),
  // Date de création réelle du challenge. `start_date` est une date métier,
  // optionnelle et éditable — elle ne peut pas servir de date de création.
  created_at: timestamp("created_at").defaultNow().notNull(),
  // Date de bascule vers 'completed'. Posée par ChallengeRepository.update(),
  // seul point de passage des deux chemins de fermeture (/close et le PUT du
  // drawer). Réécrite si le challenge est rouvert puis refermé : l'événement
  // qui intéresse le digest est la dernière fermeture, pas la première.
  // 'archived' ne la pose pas — archiver retire des listings, ça ne termine pas.
  closed_at: timestamp("closed_at"),
}, (table) => ({
  projectIdIdx: index("idx_challenges_project_id").on(table.project_id),
  statusIdx: index("idx_challenges_status").on(table.status),
}));

// --- CHALLENGE_REPOS ---
export const challenge_repos = pgTable("challenge_repos", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  repo_id: uuid("repo_id").references(() => repos.uuid, { onDelete: "cascade" }),
  // Rôle du repo dans le flow ML: dataset | model | model_code | api.
  // Explicite plutôt que déduit du type, car l'étape modèle a deux repos
  // (kaggle_model + github) et le type ne suffit plus à les distinguer.
  role: varchar("role", { length: 20 }),
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
// Membership + participation d'un contributeur sur un challenge. Pour les
// challenges code, porte le workspace personnel : la branche provisionnée
// (mode provided_repo) ou l'URL du repo fourni (mode own_repo).
export const challenge_teams = pgTable("challenge_teams", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  workspace_provider: varchar("workspace_provider", { length: 32 }), // github | external
  workspace_ref: varchar("workspace_ref", { length: 200 }),          // ex: refs/heads/contrib/015-alice
  workspace_url: text("workspace_url"),
  workspace_status: varchar("workspace_status", { length: 20 }),     // pending | ready | failed
  // NULL = participation solo. Deux rows du même challenge partageant un
  // group_id forment un groupe : elles se partagent le workspace porté par
  // celle du créateur. Voir services/challenge/group.ts.
  group_id: uuid("group_id"),
}, (table) => ({
  challengeIdIdx: index("idx_challenge_teams_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_challenge_teams_user_id").on(table.user_id),
  compositeIdx: index("idx_challenge_teams_composite").on(table.challenge_id, table.user_id),
  groupIdx: index("idx_challenge_teams_group").on(table.challenge_id, table.group_id),
  uniqueMembership: uniqueIndex("idx_challenge_teams_unique").on(table.challenge_id, table.user_id),
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
  // URL normalisée de l'artefact soumis (Kaggle/GitHub). Indexée: c'est la clé
  // de détection de réutilisation entre contributeurs d'un même challenge.
  artifact_url: varchar("artifact_url", { length: 500 }),
  // Deployed API endpoint for an `api_packaging` contribution — distinct from
  // `artifact_url` (the GitHub packaging repo). Set by an admin/manager when
  // adding this contribution as a validation target (see validation-targets
  // route's POST), not declared by the contributor.
  live_endpoint_url: varchar("live_endpoint_url", { length: 500 }),
  // pending | running | done | failed | skipped_reuse
  evaluation_status: varchar("evaluation_status", { length: 20 }),
  submitted_at: timestamp("submitted_at").defaultNow().notNull(),
  // Date de création, distincte de submitted_at qui vaut "dernière soumission"
  // (code-rewards.service.ts la réécrit à chaque ré-évaluation) et qui sert
  // par ailleurs à l'antériorité de réutilisation dans lineage.ts.
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdIdx: index("idx_contributions_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_contributions_user_id").on(table.user_id),
  taskIdIdx: index("idx_contributions_task_id").on(table.task_id),
  artifactUrlIdx: index("idx_contributions_artifact_url").on(table.challenge_id, table.artifact_url),
}));

// --- REWARD_ENTRIES ---
// Ledger append-only des attributions de points sur les challenges ML.
// Chaque ligne est immuable : une amélioration de modèle ajoute un delta, elle
// ne met pas à jour l'existant. `contributions.reward` est l'agrégat de ces lignes.
export const reward_entries = pgTable("reward_entries", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }),
  // dataset | model_metric | model_code | beat_best | api_packaging | reuse_dataset | reuse_model
  rule_key: varchar("rule_key", { length: 40 }).notNull(),
  points: integer("points").notNull(), // négatif pour un prélèvement
  source_user_id: uuid("source_user_id").references(() => users.uuid, { onDelete: "set null" }),
  meta: json("meta"), // { metricValue, agentScore, rawPoints, clampedTo, ... }
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdIdx: index("idx_reward_entries_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_reward_entries_user_id").on(table.user_id),
  contributionIdIdx: index("idx_reward_entries_contribution_id").on(table.contribution_id),
}));

// --- CONTRIBUTION_MEMBERS ---
// Parts de CP des membres d'un groupe sur une contribution.
//
// Aucune row pour une contribution solo : l'absence de membres signifie "tout
// le reward revient à contributions.user_id". `share_cp` est cumulatif — le
// scoring des challenges code est itératif, chaque run ajoute son delta à la
// part existante. L'invariant Σ share_cp = contributions.reward tient donc en
// permanence, et c'est lui que lit le leaderboard.
export const contribution_members = pgTable("contribution_members", {
  contribution_id: uuid("contribution_id").notNull().references(() => contributions.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").notNull().references(() => users.uuid, { onDelete: "cascade" }),
  share_cp: integer("share_cp").default(0).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contribution_id, table.user_id], name: "contribution_members_pk" }),
  // La PK ne couvre pas le sens user → contributions, que lit le leaderboard.
  userIdIdx: index("idx_contribution_members_user_id").on(table.user_id),
}));

// --- VALIDATION_TARGETS ---
// What an admin exposed on a validation challenge: one row per api_packaging
// contribution selected for manual testing.
export const validation_targets = pgTable("validation_targets", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  position: integer("position").default(0),
  // 'pending' until required_validations verdicts are collected, then
  // permanently 'works' or 'broken'. Written only by the resolve step.
  outcome: varchar("outcome", { length: 20 }).default("pending"),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_targets_challenge_id").on(table.validation_challenge_id),
  uniqueTargetIdx: uniqueIndex("idx_validation_targets_unique").on(table.validation_challenge_id, table.contribution_id),
}));

// --- VALIDATION_REFERENCE_CASES ---
// Ground-truth ("known input -> expected output") cases authored by a
// medical_pro (see challenges/challenge-014-qualified_validation/SPEC.md).
// Exactly `required_validations` cases per validation challenge — enforced
// at the service layer (ReferenceCaseService), not here, since a DB CHECK
// can't see sibling-row counts. Shared across every target on the challenge:
// the correct answer for a case doesn't depend on which contributor is being
// tested. Claim exclusivity is per-target, tracked on validation_case_claims
// below, not here — the same case can be claimed independently on several
// targets.
export const validation_reference_cases = pgTable("validation_reference_cases", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  // Kept even if the author account is later deleted — the case itself
  // stays valid ground truth regardless of who wrote it.
  author_user_id: uuid("author_user_id").references(() => users.uuid, { onDelete: "set null" }),
  input_bytes: bytea("input_bytes").notNull(),
  input_filename: varchar("input_filename", { length: 255 }).notNull(),
  input_content_type: varchar("input_content_type", { length: 255 }).notNull(),
  // Never SELECTed outside ReferenceCaseRepository.findExpectedOutputById —
  // that's the one enforcement point for "never leaked before reveal".
  expected_output_bytes: bytea("expected_output_bytes").notNull(),
  expected_output_filename: varchar("expected_output_filename", { length: 255 }),
  expected_output_content_type: varchar("expected_output_content_type", { length: 255 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_reference_cases_challenge_id").on(table.validation_challenge_id),
}));

// --- VALIDATION_CASE_CLAIMS ---
// "Claim and test are one gesture": a row only ever appears already carrying
// the real endpoint response — there is no separate reservation step, so
// there is no abandoned-claim state to clean up. The unique index is the
// actual per-target exclusivity guarantee under concurrent claims, mirroring
// idx_validation_attempts_unique's null-on-race contract below.
export const validation_case_claims = pgTable("validation_case_claims", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  reference_case_id: uuid("reference_case_id").references(() => validation_reference_cases.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  validator_user_id: uuid("validator_user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // The real endpoint response for this exact test — set atomically at claim
  // creation, never re-fetched afterwards.
  response_bytes: bytea("response_bytes").notNull(),
  response_content_type: varchar("response_content_type", { length: 255 }).notNull(),
  response_status: integer("response_status").notNull(),
  // Free-text note on what the medical_pro saw, recorded BEFORE reveal.
  observation: text("observation"),
  observed_at: timestamp("observed_at"),
  // Set once, server-side, only after observed_at is non-null — the
  // anti-confirmation-bias enforcement point (see ReferenceCaseService).
  revealed_at: timestamp("revealed_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  contributionIdx: index("idx_validation_case_claims_contribution_id").on(table.contribution_id),
  validatorIdx: index("idx_validation_case_claims_validator_id").on(table.validator_user_id),
  // The actual per-target claim-exclusivity guarantee under races — mirrors
  // ValidationAttemptRepository.create's null-on-23505 contract.
  uniqueClaimIdx: uniqueIndex("idx_validation_case_claims_unique").on(table.reference_case_id, table.contribution_id),
}));

// --- VALIDATION_ATTEMPTS ---
// One row per final verdict cast by a medical_pro on a given target. Traces
// back to the claim (and thus the reference case, the live response, and the
// observation) that produced it via reference_case_claim_id.
//
// file_bytes/file_filename/file_content_type and response_bytes/
// response_content_type/response_status are left null on every new row — for
// a claim-backed verdict the evidence lives on validation_case_claims (the
// live response) and validation_reference_cases (the input file) instead,
// reachable via reference_case_claim_id. The columns themselves are kept
// (not dropped) purely so validation-runs' byte-serving routes don't need a
// destructive migration; those routes fall back to the claim/case when
// reference_case_claim_id is set.
//
// purgeContentForChallenge (validationAttempt.repo.ts) still exists but is no
// longer wired to challenge archival (see SPEC 4.4) — no retention policy has
// been decided yet, so nothing purges these columns automatically anymore.
export const validation_attempts = pgTable("validation_attempts", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  validator_user_id: uuid("validator_user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // 'works' | 'broken' — what the validator concluded after seeing the
  // endpoint's output. Not nullable: a row only exists once a verdict is cast.
  verdict: varchar("verdict", { length: 10 }).notNull(),
  // Justification — required on every verdict (works and broken alike) as of
  // challenge-014, enforced at the API layer (zod), not here.
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
  // The file the validator dropped, exactly as sent alongside their verdict.
  file_bytes: bytea("file_bytes"),
  file_filename: varchar("file_filename", { length: 255 }),
  file_content_type: varchar("file_content_type", { length: 255 }),
  // The target endpoint's raw response, exactly as the validator saw it.
  response_bytes: bytea("response_bytes"),
  response_content_type: varchar("response_content_type", { length: 255 }),
  response_status: integer("response_status"),
  // Set once the file/response bytes above are purged. No longer set by any
  // automatic path as of challenge-014 — see the table-level comment above.
  purged_at: timestamp("purged_at"),
  // Which claim (case + live response + observation) this verdict was cast
  // from — null only for pre-challenge-014 rows, none of which exist yet.
  reference_case_claim_id: uuid("reference_case_claim_id").references(() => validation_case_claims.uuid, { onDelete: "set null" }),
}, (table) => ({
  challengeIdIdx: index("idx_validation_attempts_challenge_id").on(table.validation_challenge_id),
  validatorIdx: index("idx_validation_attempts_validator_id").on(table.validator_user_id),
  uniqueAttemptIdx: uniqueIndex("idx_validation_attempts_unique").on(table.validation_challenge_id, table.contribution_id, table.validator_user_id),
}));

// --- COMPUTE REQUESTS (Scaleway GPU) ---
// One row per (challenge, contributor) request for a temporary GPU instance —
// the unique index is what actually enforces "one request per ML challenge"
// under races, not just the service-layer check.
export const compute_requests = pgTable("compute_requests", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed'
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  decided_at: timestamp("decided_at"),
  decided_by: uuid("decided_by").references(() => users.uuid),
  approved_at: timestamp("approved_at"),
  // Fixed at approval time (approved_at + 24h) — not extended by anything.
  expires_at: timestamp("expires_at"),
  provisioning_started_at: timestamp("provisioning_started_at"),
  ready_at: timestamp("ready_at"),
  expired_at: timestamp("expired_at"),
  // 'timeout' | 'challenge_closed' | 'challenge_deleted'
  expire_reason: varchar("expire_reason", { length: 20 }),
  failed_at: timestamp("failed_at"),
  error_message: text("error_message"),
  // Self-describing provisioner ref, e.g. "fr-par-2/<serverId>", so
  // deprovision/getStatus never need extra context beyond this string.
  provider_ref: varchar("provider_ref", { length: 128 }),
  provider_parent_ref: varchar("provider_parent_ref", { length: 128 }),
  jupyter_base_url: text("jupyter_base_url"), // never includes the access token
  access_token_enc: text("access_token_enc"),
  access_token_iv: varchar("access_token_iv", { length: 64 }),
  access_token_revealed_at: timestamp("access_token_revealed_at"),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_compute_requests_challenge_id").on(table.challenge_id),
  statusIdx: index("idx_compute_requests_status").on(table.status),
  uniqueRequestIdx: uniqueIndex("idx_compute_requests_unique").on(table.challenge_id, table.user_id),
}));

// --- TASKS ---
// user_id NULL = tâche template (définie par l'admin/manager, copiée dans le
// board de chaque contributeur au join). Non-null = tâche du board personnel.
// Le statut est entièrement stocké — plus rien n'est dérivé d'une assignation.
export const tasks = pgTable("tasks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  parent_task_id: uuid("parent_task_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("todo"), // todo | in_progress | done
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_tasks_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_tasks_user_id").on(table.user_id),
  parentTaskIdIdx: index("idx_tasks_parent_task_id").on(table.parent_task_id),
  challengeUserIdx: index("idx_tasks_challenge_user").on(table.challenge_id, table.user_id),
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

// --- CHALLENGE SIGNALS ---
// Signaux de contribution détectables dans les canaux de discussion (Slack).
// Chaque signal a une définition écrite (envoyée au LLM) et une récompense CP fixe.
export const challenge_signals = pgTable("challenge_signals", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").notNull().references(() => challenges.uuid, { onDelete: "cascade" }),
  label: varchar("label", { length: 120 }).notNull(),
  description: text("description"),
  reward_cp: integer("reward_cp").notNull().default(0),
  icon: varchar("icon", { length: 32 }), // clé d'icône lucide (ex: 'lightbulb')
  position: integer("position").default(0),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_challenge_signals_challenge_id").on(table.challenge_id),
}));

// --- CHALLENGE SLACK CONFIGS ---
// Canal Slack surveillé pour un challenge + état opérationnel du cron d'ingestion.
// `last_ts` est le ts Slack (string décimale) du dernier message traité — jamais
// converti en number pour ne pas perdre de précision.
export const challenge_slack_configs = pgTable("challenge_slack_configs", {
  challenge_id: uuid("challenge_id").primaryKey().references(() => challenges.uuid, { onDelete: "cascade" }),
  channel_id: varchar("channel_id", { length: 32 }).notNull(),
  channel_name: varchar("channel_name", { length: 120 }),
  last_ts: varchar("last_ts", { length: 32 }),
  last_run_at: timestamp("last_run_at"),
  last_error: text("last_error"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

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
  signals: many(challenge_signals),
  slack_config: one(challenge_slack_configs),
}));

export const challengeSignalsRelations = relations(challenge_signals, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challenge_signals.challenge_id],
    references: [challenges.uuid],
  }),
}));

export const challengeSlackConfigsRelations = relations(challenge_slack_configs, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challenge_slack_configs.challenge_id],
    references: [challenges.uuid],
  }),
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

export const contributionsRelations = relations(contributions, ({ one, many }) => ({
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
  reward_entries: many(reward_entries),
}));

export const rewardEntriesRelations = relations(reward_entries, ({ one }) => ({
  challenge: one(challenges, {
    fields: [reward_entries.challenge_id],
    references: [challenges.uuid],
  }),
  user: one(users, {
    fields: [reward_entries.user_id],
    references: [users.uuid],
  }),
  contribution: one(contributions, {
    fields: [reward_entries.contribution_id],
    references: [contributions.uuid],
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

export const contributionMembersRelations = relations(contribution_members, ({ one }) => ({
  contribution: one(contributions, {
    fields: [contribution_members.contribution_id],
    references: [contributions.uuid],
  }),
  user: one(users, {
    fields: [contribution_members.user_id],
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
  // Kaggle API key connection
  kaggle_username: varchar("kaggle_username", { length: 255 }),
  kaggle_key_enc: text("kaggle_key_enc"),
  kaggle_key_iv: varchar("kaggle_key_iv", { length: 64 }),
  kaggle_connected_at: timestamp("kaggle_connected_at"),
  kaggle_connected_by: uuid("kaggle_connected_by").references(() => users.uuid),
  // OpenAI API key connection
  openai_key_enc: text("openai_key_enc"),
  openai_key_iv: varchar("openai_key_iv", { length: 64 }),
  openai_connected_at: timestamp("openai_connected_at"),
  openai_connected_by: uuid("openai_connected_by").references(() => users.uuid),
  // Slack bot token connection
  slack_token_enc: text("slack_token_enc"),
  slack_token_iv: varchar("slack_token_iv", { length: 64 }),
  slack_team_name: varchar("slack_team_name", { length: 255 }),
  slack_connected_at: timestamp("slack_connected_at"),
  slack_connected_by: uuid("slack_connected_by").references(() => users.uuid),
  modules_meetings_enabled: boolean("modules_meetings_enabled").notNull().default(true),
  modules_onboarding_enabled: boolean("modules_onboarding_enabled").notNull().default(true),
  // Scaleway GPU compute connection
  scaleway_secret_key_enc: text("scaleway_secret_key_enc"),
  scaleway_secret_key_iv: varchar("scaleway_secret_key_iv", { length: 64 }),
  scaleway_project_id: varchar("scaleway_project_id", { length: 64 }),
  scaleway_zone: varchar("scaleway_zone", { length: 32 }),
  scaleway_connected_at: timestamp("scaleway_connected_at"),
  scaleway_connected_by: uuid("scaleway_connected_by").references(() => users.uuid),
  scaleway_disconnect_requested_at: timestamp("scaleway_disconnect_requested_at"),
  // Digest — voir docs/input/spec-digest.md. Désactivé par défaut : une feature
  // d'admin ne s'active pas seule sur les instances existantes.
  digest_enabled: boolean("digest_enabled").notNull().default(false),
  digest_frequency_days: integer("digest_frequency_days").notNull().default(7),
});

// --- DIGESTS ---
// Snapshot périodique et immuable de l'activité de la plateforme.
//
// La table est son propre curseur : period_start vaut toujours le period_end de
// la row précédente, donc deux digests consécutifs ne peuvent ni laisser de
// trou ni se recouvrir, et aucun champ "dernière génération" n'est nécessaire
// dans app_settings.
//
// Le payload est dénormalisé (noms, titres, montants tels qu'ils étaient) et
// n'est jamais régénéré : une contribution supprimée, un cache de reward
// reconstruit par db-resync-rewards au déploiement ou un compte fusionné ne
// doivent pas rendre un digest passé faux ou illisible.
export const digests = pgTable("digests", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  period_start: timestamp("period_start").notNull(),
  period_end: timestamp("period_end").notNull(),
  generated_at: timestamp("generated_at").defaultNow().notNull(),
  // 'cron' | 'manual'. Nommé trigger_source et non trigger : le mot est libre
  // en Postgres mais ambigu, et evaluation_runs porte déjà un "trigger type".
  trigger_source: varchar("trigger_source", { length: 10 }).notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => ({
  periodEndIdx: index("idx_digests_period_end").on(table.period_end),
}));

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
  // Toutes les colonnes de dates sont des `timestamp` sans fuseau, et elles
  // sont alimentées par deux chemins : `defaultNow()` exécute now() côté
  // serveur, tandis qu'une valeur passée par Drizzle est sérialisée en ISO,
  // donc en UTC. Sur un serveur en Europe/Paris, la même seconde s'écrit
  // 14:12 par le premier chemin et 12:12 par le second — et rien ne rattrape
  // l'écart, puisque Postgres compare alors deux nombres nus.
  //
  // Personne ne s'en apercevait tant qu'aucun code ne comparait les deux
  // familles entre elles. Le digest le fait (created_at rempli par le serveur
  // contre des bornes de fenêtre venues de JS) et rejetait tout ce qui datait
  // des deux dernières heures.
  //
  // Forcer la session en UTC aligne now() sur ce qu'écrit Drizzle. Les lignes
  // déjà écrites en heure locale gardent leur avance : c'est de l'historique,
  // et le reconvertir demanderait de savoir colonne par colonne qui l'a écrite.
  options: "-c timezone=UTC",
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
    contribution_members,
    tasks,
    refresh_tokens,
    evaluation_runs,
    evaluation_run_contributions,
    evaluation_grids,
    evaluation_grid_categories,
    evaluation_grid_subcriteria,
    sync_meetings,
    meeting_participants,
    meeting_analyses,
    projectsRelations,
    reposRelations,
    challenge_documents,
    challenge_signals,
    challenge_slack_configs,
  challengeDocumentsRelations,
  challengeSignalsRelations,
  challengeSlackConfigsRelations,
  challengesRelations,
    challengeReposRelations,
    challengeTeamsRelations,
    usersRelations,
    contributionsRelations,
    contributionMembersRelations,
    tasksRelations,
    refreshTokensRelations,
    evaluationGridsRelations,
    evaluationGridCategoriesRelations,
    evaluationGridSubcriteriaRelations,
    syncMeetingsRelations,
    meetingParticipantsRelations,
    meetingAnalysesRelations,
    onboardingProgressRelations,
    app_settings,
    compute_requests,
    digests,
  },
});