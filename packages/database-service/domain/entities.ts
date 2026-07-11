// domain/entities.ts

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

export interface ChallengeRepo {
  challenge_id: string; // FK -> challenges.uuid
  repo_id: string;      // FK -> repos.uuid
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
  type: string; // 'code' | 'ml' | ...
  start_date: Date;
  end_date: Date;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  completion: number;
  project_id: string; // FK -> projects.uuid
}

export interface ChallengeDocument {
  uuid: string;
  challenge_id: string; // FK -> challenges.uuid
  filename: string;
  content: string;
  uploaded_by?: string; // FK -> users.uuid
  created_at: Date;
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
  task_id?: string;     // FK -> tasks.uuid
  submitted_at: Date;
}

export interface User {
  uuid: string;
  role: string;
  full_name: string;
  github_username?: string;
  email?: string;
  google_user_id?: string;
  bio?: string;
  avatar_url?: string;
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
  repo_id?: string;
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

// --- WORKSPACE TYPES ---

export type WorkspaceStatus = 'pending' | 'ready' | 'failed';

export interface WorkspaceMeta {
  baseBranch?: string;
  createdAt?: string;
  error?: string;
  sha?: string;
  [key: string]: unknown;
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
  created_by: string;
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

export interface ContributionSignal {
  user_id?: string;
  display_name: string;
  signal_type: 'coordination' | 'technical_leadership' | 'problem_solving' | 'knowledge_sharing';
  weight: number;
  description?: string;
}

export interface MeetingAnalysis {
  uuid: string;
  sync_meeting_id: string;
  summary?: string;
  decisions?: Decision[];
  actions?: Action[];
  contribution_signals?: ContributionSignal[];
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
