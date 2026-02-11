// domain/entities.ts

export interface Project {
  uuid: string;
  title: string;
  description?: string;
  created_at: Date;
}

export interface Repo {
  uuid: string;
  title: string;
  type: string;
  external_repo_id?: string;
  project_id: string; // FK -> projects.uuid
}

// --- WORKSPACE TYPES ---

export type WorkspaceStatus = 'pending' | 'ready' | 'failed';

export interface WorkspaceMeta {
  baseBranch?: string;
  sha?: string;
  createdAt?: string;
  error?: string;
  alreadyExisted?: boolean;
  [key: string]: unknown;
}

export interface ChallengeRepo {
  challenge_id: string; // FK -> challenges.uuid
  repo_id: string;      // FK -> repos.uuid
  // Workspace provisioning fields
  workspace_provider?: string;
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: WorkspaceStatus;
  workspace_meta?: WorkspaceMeta;
}

export interface ChallengeTeam {
  challenge_id: string; // FK -> challenges.uuid
  user_id: string;      // FK -> users.uuid
}

export interface Challenge {
  uuid: string;
  index?: number;
  title: string;
  status: string;
  start_date: Date;
  end_date: Date;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  completion: number;
  project_id: string; // FK -> projects.uuid
}

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
  submitted_at: Date;
}

export interface User {
  uuid: string;
  role: string;
  full_name: string;
  github_username: string;
  bio?: string;
  password_hash?: string;
  created_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface Task {
  uuid: string;
  challenge_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  type: "solo" | "concurrent";
  status: "todo" | "done";
  created_at: Date;
}

export interface TaskAssignee {
  task_id: string;
  user_id: string;
  assigned_at: Date;
}

export interface TaskWorkspace {
  task_id: string;
  repo_id: string;
  // Workspace provisioning fields
  workspace_provider?: string;
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: WorkspaceStatus;
  workspace_meta?: WorkspaceMeta;
}

// --- EVALUATION RUNS ---

export type EvaluationRunTriggerType = 'manual' | 'sync' | 'github_pr';
export type EvaluationRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvaluationRunMeta {
  contributionCount?: number;
  durationMs?: number;
  evaluatorVersion?: string;
  gridVersion?: number;
  [key: string]: unknown;
}

export interface EvaluationRun {
  uuid: string;
  challenge_id: string;
  trigger_type: EvaluationRunTriggerType;
  trigger_payload?: Record<string, unknown>;
  window_start: Date;
  window_end: Date;
  status: EvaluationRunStatus;
  started_at?: Date;
  finished_at?: Date;
  error_code?: string;
  error_message?: string;
  created_by?: string;
  retry_of_run_id?: string;
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
