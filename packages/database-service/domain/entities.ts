// domain/entities.ts

import type { MlRewardRules } from "./mlRewardRules.js";
import type { CodeRewardRules } from "./codeRewardRules.js";

export interface Project {
  uuid: string;
  title: string;
  description?: string;
  manager_id?: string | null; // FK → users.uuid, nullable
  created_at: Date;
}

export interface Repo {
  uuid: string;
  title: string;
  type: string;
  external_repo_id?: string;
  project_id: string; // FK -> projects.uuid
}

/** Rôle d'un repo dans le flow ML. Null pour les challenges de type code. */
export type ChallengeRepoRole = 'dataset' | 'model' | 'model_code' | 'api';

export interface ChallengeRepo {
  challenge_id: string; // FK -> challenges.uuid
  repo_id: string;      // FK -> repos.uuid
  role?: ChallengeRepoRole;
  workspace_provider?: string;
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: WorkspaceStatus;
  workspace_meta?: WorkspaceMeta;
}

export interface ChallengeTeam {
  challenge_id: string; // FK -> challenges.uuid
  user_id: string;      // FK -> users.uuid
  workspace_provider?: 'github' | 'external';
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: WorkspaceStatus;
  /**
   * Groupe de travail sur ce challenge. `undefined` = participation solo,
   * comportement inchangé. Les rows d'un même challenge qui le partagent
   * travaillent sur le workspace du créateur du groupe — celui dont la row
   * porte le `workspace_ref`. Voir capabilities/groups.ts.
   */
  group_id?: string;
}

export type ChallengeWorkspaceMode = 'provided_repo' | 'own_repo';

export interface Challenge {
  uuid: string;
  index?: number;
  title: string;
  /** Segment de l'URL publique (/challenges/<slug>) — voir domain/slug.ts. */
  slug: string;
  status: string;
  type: string; // 'code' | 'ml' | ...
  start_date?: Date | null;
  end_date?: Date | null;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  completion: number;
  project_id: string; // FK -> projects.uuid
  /** Règles de récompense, éditables. Leur forme appartient au flow, qui les lit (`rules.parse`). */
  reward_rules?: unknown;
  source_challenge_id?: string | null; // Lien générique vers un challenge parent (validation aujourd'hui)
  /**
   * Configuration du flow, fixée à la création (sections d'extensions mises à
   * part). Lue par la capacité `flow-config`, qui la monte à la version courante.
   */
  flow_config?: Record<string, unknown> | null;
  /** Version sous laquelle `flow_config` a été écrite. */
  flow_config_version?: number;
  created_at: Date;
  closed_at?: Date | null; // Posée à la bascule vers 'completed' (jamais 'archived')
}

/** Signal de contribution détectable dans un canal de discussion (Slack). */
export interface ChallengeSignal {
  uuid: string;
  challenge_id: string; // FK -> challenges.uuid
  label: string;
  description?: string;
  reward_cp: number;
  icon?: string | null; // clé d'icône lucide (ex: 'lightbulb')
  position: number;
  created_at: Date;
}

/** Canal Slack surveillé pour un challenge + état du cron d'ingestion. */
export interface ChallengeSlackConfig {
  challenge_id: string; // PK, FK -> challenges.uuid
  channel_id: string;
  channel_name?: string | null;
  last_ts?: string | null; // ts Slack (string décimale), curseur exclusif
  last_run_at?: Date | null;
  last_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChallengeDocument {
  uuid: string;
  challenge_id: string; // FK -> challenges.uuid
  filename: string;
  content: string;
  uploaded_by?: string; // FK -> users.uuid
  created_at: Date;
}

export type ContributionEvaluationStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped_reuse';

export interface Contribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  evaluation?: any; // JSON structure – à typer plus tard
  tags?: string[];
  reward: number;
  user_id: string;      // FK -> users.uuid
  challenge_id: string; // FK -> challenges.uuid
  task_id?: string;     // FK -> tasks.uuid
  artifact_url?: string;
  live_endpoint_url?: string; // api_packaging uniquement — endpoint déployé
  evaluation_status?: ContributionEvaluationStatus;
  /** Dernière soumission — réécrite à chaque ré-évaluation. Sert aussi à
   *  l'antériorité de réutilisation (lineage.ts). Pas une date de création. */
  submitted_at: Date;
  created_at: Date;
}

// --- REWARD ENTRIES (ledger) ---

/**
 * Clé d'une ligne de ledger. Les clés ne sont pas une liste fermée : chaque
 * flow, extension ou kit installé déclare les siennes, et l'écriture refuse une
 * clé que rien ne déclare (`packages/registry/platform.ts`).
 */
export type RewardRuleKey = string;

export interface RewardEntryMeta {
  metricValue?: number;
  agentScore?: number;
  rawPoints?: number;
  clampedTo?: number;
  sourceContributionId?: string;
  [key: string]: unknown;
}

export interface RewardEntry {
  uuid: string;
  challenge_id: string;
  user_id: string;
  contribution_id?: string;
  rule_key: RewardRuleKey;
  points: number; // négatif pour un prélèvement
  source_user_id?: string;
  meta?: RewardEntryMeta;
  created_at: Date;
}

/** Une ligne de ledger à écrire, sans les champs générés par la base. */
export type RewardEntryDraft = Omit<RewardEntry, "uuid" | "created_at">;

/**
 * Part de CP d'un membre de groupe sur une contribution.
 *
 * Aucune row n'existe pour une contribution solo : l'absence de membres veut
 * dire "tout le reward revient à `contributions.user_id`". `share_cp` est
 * cumulatif — chaque run de scoring ajoute son delta — de sorte que
 * Σ share_cp = contributions.reward à tout instant.
 */
export interface ContributionMember {
  contribution_id: string; // FK -> contributions.uuid
  user_id: string;         // FK -> users.uuid
  share_cp: number;
}

// --- VALIDATION CHALLENGES ---

/** Une soumission api_packaging exposée pour validation manuelle. */
export interface ValidationTarget {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la soumission api_packaging)
  position: number;
  outcome: 'pending' | 'works' | 'broken';
  resolved_at: Date | null;
  created_at: Date;
}

/**
 * Un cas de vérité terrain (entrée connue -> sortie attendue), écrit par un
 * relecteur qualifié. Partagé par tout le challenge de validation — voir
 * challenges/challenge-014-qualified_validation/SPEC.md section 4.3.
 */
export interface ValidationReferenceCase {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  author_user_id: string | null;   // FK -> users.uuid (le relecteur auteur)
  input_bytes: Buffer;
  input_filename: string;
  input_content_type: string;
  expected_output_bytes: Buffer;         // ne jamais exposer hors de la révélation
  expected_output_filename: string | null;
  expected_output_content_type: string;
  created_at: Date;
  purged_at?: Date | null;               // non-null une fois les octets purgés
}

/**
 * La réclamation d'un cas de référence par un relecteur qualifié sur un target
 * donné : réponse réelle capturée à la réclamation (un seul geste atomique),
 * puis observation, puis révélation — dans cet ordre, appliqué côté service.
 */
export interface ValidationCaseClaim {
  uuid: string;
  reference_case_id: string;   // FK -> validation_reference_cases.uuid
  contribution_id: string;     // FK -> contributions.uuid (le target testé)
  validator_user_id: string;   // FK -> users.uuid
  response_bytes: Buffer;
  response_content_type: string;
  response_status: number;
  observation: string | null;      // noté avant la révélation
  observed_at: Date | null;
  revealed_at: Date | null;        // non-null seulement après observed_at
  created_at: Date;
  purged_at?: Date | null;         // non-null une fois response_bytes purgé
}

/** Un verdict (works/broken) rendu par un relecteur qualifié sur une cible donnée. */
export interface ValidationAttempt {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la cible validée)
  validator_user_id: string;       // FK -> users.uuid
  verdict: 'works' | 'broken';
  description: string | null;      // requis côté API quel que soit le verdict
  created_at: Date;
  file_bytes: Buffer | null;             // legacy — toujours null depuis challenge-014
  file_filename: string | null;
  file_content_type: string | null;
  response_bytes: Buffer | null;         // legacy — toujours null depuis challenge-014
  response_content_type: string | null;
  response_status: number | null;
  purged_at: Date | null;                // non-null une fois le contenu purgé (plus déclenché automatiquement)
  reference_case_claim_id: string | null; // FK -> validation_case_claims.uuid
}

/** Ce qu'un validateur a conclu d'une étape : déjà un vote, simplement non compté en v1. */
export type ScenarioStepResult = 'passed' | 'failed' | 'blocked';

/** Une étape du scénario d'un challenge de validation en mode scénario (source `code`). */
export interface ValidationScenarioStep {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  position: number;                // dense, 0-based
  title: string;
  instructions: string | null;
  created_at: Date;
}

/**
 * Le passage d'un validateur sur une application. `completed_at === null`
 * signifie brouillon : reprenable à l'identique, modifiable partout.
 * Une fois complété, immuable — et payé.
 */
export interface ValidationScenarioRun {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (l'application parcourue)
  validator_user_id: string;       // FK -> users.uuid
  global_feedback: string | null;  // requis à la complétion
  completed_at: Date | null;
  created_at: Date;
}

/** Le retour d'un validateur sur une étape : un résultat, un commentaire UX, et un avis médical réservé à la qualification exigée. */
export interface ValidationStepFeedback {
  uuid: string;
  run_id: string;  // FK -> validation_scenario_runs.uuid
  step_id: string; // FK -> validation_scenario_steps.uuid
  result: ScenarioStepResult;
  comment: string | null;
  medical_comment: string | null;
  created_at: Date;
}

export type ComputeRequestStatus = 'pending' | 'rejected' | 'approved' | 'provisioning' | 'ready' | 'expired' | 'failed';
export type ComputeRequestExpireReason = 'timeout' | 'challenge_closed' | 'challenge_deleted';

/** Une demande de puissance de calcul GPU (Scaleway) sur un challenge ML. */
export interface ComputeRequest {
  uuid: string;
  challenge_id: string; // FK -> challenges.uuid
  user_id: string;      // FK -> users.uuid
  status: ComputeRequestStatus;
  requested_at: Date;
  decided_at: Date | null;
  decided_by: string | null;   // FK -> users.uuid (manager/admin)
  approved_at: Date | null;
  expires_at: Date | null;     // figé à approved_at + 24h
  provisioning_started_at: Date | null;
  ready_at: Date | null;
  expired_at: Date | null;
  expire_reason: ComputeRequestExpireReason | null;
  failed_at: Date | null;
  error_message: string | null;
  provider_ref: string | null;         // ex: "fr-par-2/<serverId>"
  provider_parent_ref: string | null;  // ex: le project_id Scaleway
  jupyter_base_url: string | null;     // jamais le token
  access_token_enc: string | null;
  access_token_iv: string | null;
  access_token_revealed_at: Date | null;
  updated_at: Date | null;
}

/**
 * Les rôles : des permissions, rien d'autre (proxy.ts,
 * components/admin/UserList.tsx, seeds). Ce qu'on reconnaît à quelqu'un de
 * compétent pour juger est une qualification (`user_qualifications`). La
 * colonne reste un varchar : cette liste borne ce que l'API accepte en
 * écriture, elle ne réinterprète pas les rows existantes.
 */
export const USER_ROLES = ['admin', 'contributor', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Une qualification détenue par un compte — voir la table user_qualifications. */
export interface UserQualification {
  user_id: string;
  key: string;
  granted_by: string | null;
  granted_at: Date;
  note: string | null;
}

export type QualificationAction = 'granted' | 'revoked';

/** Trace d'un octroi ou d'un retrait de qualification — voir la table qualification_changes. */
export interface QualificationChange {
  uuid: string;
  user_id: string;
  key: string;
  action: QualificationAction;
  changed_by: string | null;
  note: string | null;
  created_at: Date;
}

/** Trace d'un changement de rôle — voir la table role_changes. */
export interface RoleChange {
  uuid: string;
  user_id: string;
  old_role: string | null;  // null = rôle attribué à la création
  new_role: string;
  changed_by: string | null; // null si l'auteur a été supprimé depuis
  note: string | null;
  created_at: Date;
}

export interface User {
  uuid: string;
  role: string;
  full_name: string;
  github_username?: string;
  email?: string;
  google_user_id?: string;
  bio?: string;
  avatar_url?: string | null;
  created_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  uuid: string;
  challenge_id: string;
  /** null/undefined = tâche template (admin), sinon propriétaire du board. */
  user_id?: string | null;
  /** null = pas de parent (ou détaché explicitement), undefined = non renseigné. */
  parent_task_id?: string | null;
  title: string;
  description?: string;
  status: TaskStatus;
  created_at: Date;
}

// --- WORKSPACE TYPES ---

export type WorkspaceStatus = 'pending' | 'ready' | 'failed';

export interface WorkspaceMeta {
  baseBranch?: string;
  createdAt?: string;
  error?: string;
  sha?: string;
  [key: string]: unknown;
}

// --- EVALUATION RUNS ---

/** La clé du flow, de l'extension ou du module qui a lancé l'évaluation (`code`, `ml`, `sandbox`…). */
export type EvaluationRunTriggerType = string;
export type EvaluationRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvaluationRunMeta {
  contributionCount?: number;
  durationMs?: number;
  evaluatorVersion?: string;
  gridVersion?: number;
  gridSlug?: string;
  bundleSource?: string;
  /** Note brute sur 0–9. */
  globalScore?: number;
  /** Le sujet évalué, quand aucune contribution ne le porte (évaluation formative d'un sandbox). */
  subject?: { title: string; type: string; ref: string };
  [key: string]: unknown;
}

export interface EvaluationRun {
  uuid: string;
  /** Absent pour une évaluation sans challenge (sandbox). */
  challenge_id?: string;
  trigger_type: EvaluationRunTriggerType;
  /** `{ handler, payload }` : ce que le rejeu rappelle. */
  trigger_payload?: Record<string, unknown>;
  /** Fenêtre de l'ancien pipeline de synchronisation ; les évaluations actuelles n'en ont pas. */
  window_start?: Date;
  window_end?: Date;
  status: EvaluationRunStatus;
  started_at?: Date;
  finished_at?: Date;
  error_code?: string;
  error_message?: string;
  created_by?: string;
  meta?: EvaluationRunMeta;
}

// --- EVALUATION RUN CONTRIBUTIONS ---

export type EvaluationRunContributionStatus = 'identified' | 'merged' | 'evaluated' | 'skipped';

export interface EvaluationRunContributionNotes {
  skipReason?: string;
  warnings?: string[];
  [key: string]: unknown;
}

export interface EvaluationRunContribution {
  uuid: string;
  run_id: string;
  contribution_id: string;
  status: EvaluationRunContributionStatus;
  notes?: EvaluationRunContributionNotes;
  created_at: Date;
}

// --- EVALUATION GRIDS ---

export type EvaluationGridStatus = 'draft' | 'published' | 'archived';
export type EvaluationGridCategoryType = 'objective' | 'mixed' | 'subjective' | 'contextual';

export interface EvaluationGrid {
  uuid: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  status: EvaluationGridStatus;
  instructions?: string;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
  created_by?: string;
}

export interface EvaluationGridCategory {
  uuid: string;
  grid_id: string;
  name: string;
  weight: number;
  type: EvaluationGridCategoryType;
  position: number;
}

export interface EvaluationGridSubcriterion {
  uuid: string;
  category_id: string;
  criterion: string;
  description?: string;
  weight?: number;
  metrics?: string[];
  indicators?: string[];
  scoring_excellent?: string;
  scoring_good?: string;
  scoring_average?: string;
  scoring_poor?: string;
  position: number;
}

// Full grid with nested categories and subcriteria
export interface EvaluationGridFull extends EvaluationGrid {
  categories: (EvaluationGridCategory & {
    subcriteria: EvaluationGridSubcriterion[];
  })[];
}

// --- SYNC MEETINGS ---

export type SyncMeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'processed' | 'cancelled';

export interface SyncMeeting {
  uuid: string;
  title: string;
  description?: string;
  challenge_id: string;
  start_time: Date;
  end_time: Date;
  meet_link?: string;
  calendar_event_id?: string;
  conference_id?: string;
  conference_record_id?: string;
  status: SyncMeetingStatus;
  created_by: string | null; // null si le créateur a été supprimé
  created_at: Date;
  updated_at: Date;
}

export interface MeetingParticipant {
  uuid: string;
  sync_meeting_id: string;
  user_id?: string;
  google_user_id: string;
  display_name: string;
}

export type MeetingAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Decision {
  description: string;
  context?: string;
  mentioned_by?: string[];
}

export interface Action {
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface MeetingAnalysis {
  uuid: string;
  sync_meeting_id: string;
  summary?: string;
  decisions?: Decision[];
  actions?: Action[];
  status: MeetingAnalysisStatus;
  processed_at?: Date;
  error_message?: string;
  created_at: Date;
}

// --- APP SETTINGS ---
export interface AppSettings {
  theme_key: string;
  primary_color?: string | null;
  background_color?: string | null;
  theme_mode: string; // "dark" | "light"
  updated_at?: Date;
  github_org?: string | null;
  github_connected_at?: Date | null;
  github_connected_by?: string | null;
  github_is_connected: boolean; // derived: !!github_token_enc in DB
  kaggle_username?: string | null;
  kaggle_connected_at?: Date | null;
  kaggle_connected_by?: string | null;
  kaggle_is_connected: boolean; // derived: !!kaggle_key_enc in DB
  openai_connected_at?: Date | null;
  openai_connected_by?: string | null;
  openai_is_connected: boolean; // derived: !!openai_key_enc in DB
  slack_team_name?: string | null;
  slack_connected_at?: Date | null;
  slack_connected_by?: string | null;
  slack_is_connected: boolean; // derived: !!slack_token_enc in DB
  modules_meetings_enabled: boolean;
  modules_onboarding_enabled: boolean;
  scaleway_project_id?: string | null;
  scaleway_zone?: string | null;
  scaleway_connected_at?: Date | null;
  scaleway_connected_by?: string | null;
  scaleway_is_connected: boolean; // derived: !!scaleway_secret_key_enc && !scaleway_disconnect_requested_at
  scaleway_disconnect_requested_at?: Date | null;
  digest_enabled: boolean;
  digest_frequency_days: number;
  /** Vide = l'économie des stars ne paie rien. Voir SandboxStarTier. */
  sandbox_star_tiers: SandboxStarTier[];
  sandbox_promotion_bonus_cp: number;
}

// --- SANDBOX ---
// Proposition ouverte déposée par un contributeur. Voir docs/sandbox.md.

/** 'validation' est exclu : un challenge de validation dérive d'un challenge ML existant. */
export type SandboxType = 'code' | 'ml';

export type SandboxStatus = 'open' | 'promoted' | 'archived';

/** Pas de 'skipped_reuse' ici : une évaluation formative n'a rien à réutiliser. */
export type SandboxEvaluationStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Sandbox {
  uuid: string;
  user_id: string;
  /** Figé à la création : il a déjà déterminé les champs saisis et la grille. */
  type: SandboxType;
  title: string;
  /** Segment de l'URL publique (/sandbox/<slug>) — voir domain/slug.ts. */
  slug: string;
  context: string | null;
  goals: string[];
  why: string | null;
  repo_url: string;
  /** ML uniquement, et optionnel : un sandbox ML peut démarrer sans artefact. */
  model_url: string | null;
  dataset_urls: string[];
  status: SandboxStatus;
  promoted_challenge_id: string | null;
  promoted_at: Date | null;
  evaluation?: any; // même forme que contributions.evaluation – à typer plus tard
  evaluation_status: SandboxEvaluationStatus | null;
  evaluated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Figé à la création : une star anonyme rattachée garde `anonymous`. */
export type SandboxStarOrigin = 'account' | 'anonymous';

export interface SandboxStar {
  uuid: string;
  sandbox_id: string;
  user_id: string | null;
  anon_id: string | null;
  origin: SandboxStarOrigin;
  ip_hash: string | null;
  created_at: Date;
  /** Non nul = unstar. La ligne reste, le compteur ne la voit plus. */
  removed_at: Date | null;
  attached_at: Date | null;
}

export type SandboxRewardRuleKey = 'star_tier' | 'promotion';

export interface SandboxReward {
  uuid: string;
  sandbox_id: string;
  /** Auteur au moment du paiement, dénormalisé pour que le leaderboard lise sans jointure. */
  user_id: string;
  rule_key: SandboxRewardRuleKey;
  /** Le seuil franchi ; null pour une promotion. */
  tier_stars: number | null;
  points: number;
  created_at: Date;
}

/** Un palier de l'économie des stars, tel que l'admin le configure. */
export interface SandboxStarTier {
  stars: number;
  cp: number;
}

// --- DIGEST ---

export type DigestTriggerSource = "cron" | "manual";

/** Une ligne de `cp_distributed`, agrégée par (user, challenge). */
export interface DigestCpRow {
  user_id: string;
  full_name: string;
  challenge_id: string;
  challenge_title: string;
  total_cp: number;
  /** Détail par rule_key — garde la nature de l'attribution sans lister le ledger. */
  by_rule: Record<string, number>;
}

/**
 * Le contenu figé d'un digest.
 *
 * Dénormalisé volontairement : un digest est un enregistrement historique, il
 * doit rester lisible même si la contribution est supprimée, le contributeur
 * renommé ou le cache de reward reconstruit.
 *
 * Les quatre premières sections sont des sections d'apparition — elles ne
 * voient un objet qu'une fois. `cp_distributed` lit le ledger et capte donc
 * aussi ce qu'une ré-évaluation rapporte à une contribution créée avant la
 * fenêtre, invisible autrement. Voir docs/input/spec-digest.md §4.
 */
export interface DigestPayload {
  /**
   * Un digest déjà généré est immuable : le type décrit donc aussi les
   * anciennes versions, et le rendu doit tolérer l'absence des sections
   * apparues après. 1 = sections initiales ; 2 = ajout de `new_sandboxes`.
   */
  version: number;
  new_contributions: Array<{
    contribution_id: string;
    title: string;
    type: string;
    challenge_id: string;
    challenge_title: string;
    /** Tous les membres d'un groupe, porteur en tête — pas seulement lui. */
    contributors: Array<{ user_id: string; full_name: string }>;
    /** Reward global de la contribution, pas une part individuelle. */
    reward_cp: number;
  }>;
  new_challenges: Array<{
    challenge_id: string;
    title: string;
    type: string;
    project_title: string;
    reward_pool: number;
  }>;
  completed_challenges: Array<{
    challenge_id: string;
    title: string;
    type: string;
    closed_at: string;
    reward_pool: number;
    cp_awarded: number;
  }>;
  new_contributors: Array<{
    user_id: string;
    full_name: string;
    role: string;
    joined_at: string;
  }>;
  /**
   * Sandboxes déposés sur la période (version ≥ 2).
   *
   * Optionnel parce qu'un digest v1 n'en a pas et reste lisible tel quel.
   *
   * Leurs CP n'apparaissent nulle part ici : `cp_distributed` agrège
   * `reward_entries` par (user, challenge), et un sandbox n'a ni challenge ni
   * contribution. C'est délibéré — cette section raconte l'arrivée de
   * propositions, pas une distribution de points.
   */
  new_sandboxes?: Array<{
    sandbox_id: string;
    title: string;
    type: string;
    author: { user_id: string; full_name: string };
    /** Stars actives au moment de la génération, pas sur la seule fenêtre. */
    star_count: number;
  }>;
  cp_distributed: DigestCpRow[];
}

export interface Digest {
  uuid: string;
  period_start: Date;
  period_end: Date;
  generated_at: Date;
  trigger_source: DigestTriggerSource;
  payload: DigestPayload;
}

// --- ONBOARDING PROGRESS WITH USER ---
export interface OnboardingProgressWithUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  clicked_challenge: boolean;
  assigned_task: boolean;
  evaluated_contribution: boolean;
  validated_task: boolean;
  joined_meeting: boolean;
  completed_at?: Date;
}

// --- ONBOARDING PROGRESS ---

export type OnboardingStep = 'clicked_challenge' | 'assigned_task' | 'evaluated_contribution' | 'validated_task' | 'joined_meeting';

export interface OnboardingProgress {
  user_id: string;
  clicked_challenge: boolean;
  assigned_task: boolean;
  evaluated_contribution: boolean;
  validated_task: boolean;
  joined_meeting: boolean;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// --- NOTIFICATIONS ---
// Voir docs/challenge-groups.md. Une notification transporte un lien, jamais
// un état : il n'y a ni acceptation, ni refus, ni « en attente ».

/** Le seul type aujourd'hui. La colonne reste une chaîne pour le suivant. */
export type NotificationType = 'group_invite';

/** Ce que porte un `group_invite` — dénormalisé, cf. le commentaire du schéma. */
export interface GroupInviteNotificationPayload {
  challengeId: string;
  challengeTitle: string;
  groupToken: string;
  fromUserId: string;
  fromName: string;
}

export interface Notification {
  uuid: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  /** Le jeton du groupe pour un `group_invite`, NULL pour un type sans dédup. */
  dedupe_key: string | null;
  read_at: Date | null;
  created_at: Date;
}
