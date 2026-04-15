// domain/schemas.ts
import { z } from "zod";

export const projectSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  created_at: z.coerce.date(),
});

export const repoSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  external_repo_id: z.string().optional(),
  project_id: z.string().uuid(),
});

export const challengeRepoSchema = z.object({
  challenge_id: z.string().uuid(),
  repo_id: z.string().uuid(),
});

export const challengeTeamSchema = z.object({
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export const challengeSchema = z.object({
  uuid: z.string().uuid(),
  index: z.number().int().optional(),
  title: z.string(),
  status: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  completion: z.number().int().nonnegative().default(0),
  project_id: z.string().uuid(),
});

export const contributionSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  evaluation: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  reward: z.number().default(0),
  user_id: z.string().uuid(),
  challenge_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  submitted_at: z.coerce.date(),
});

export const userSchema = z.object({
  uuid: z.string().uuid(),
  role: z.string(),
  full_name: z.string(),
  github_username: z.string(),
  bio: z.string().optional(),
  password_hash: z.string().optional(),
  created_at: z.coerce.date(),
});

export const refreshTokenSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  token_hash: z.string(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date(),
});

export const taskSchema = z.object({
  uuid: z.string().uuid(),
  challenge_id: z.string().uuid(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["solo", "concurrent"]),
  status: z.enum(["todo", "done"]),
  created_at: z.coerce.date(),
});

export const taskAssigneeSchema = z.object({
  task_id: z.string().uuid(),
  user_id: z.string().uuid(),
  assigned_at: z.coerce.date(),
});

// --- EVALUATION RUNS ---

export const evaluationRunTriggerTypeSchema = z.enum(['manual', 'sync', 'github_pr']);
export const evaluationRunStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'canceled']);

export const evaluationRunMetaSchema = z.object({
  contributionCount: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  evaluatorVersion: z.string().optional(),
  gridVersion: z.number().int().optional(),
}).passthrough();

export const evaluationRunSchema = z.object({
  uuid: z.string().uuid(),
  challenge_id: z.string().uuid(),
  trigger_type: evaluationRunTriggerTypeSchema,
  trigger_payload: z.record(z.string(), z.unknown()).optional(),
  window_start: z.coerce.date(),
  window_end: z.coerce.date(),
  status: evaluationRunStatusSchema,
  started_at: z.coerce.date().optional(),
  finished_at: z.coerce.date().optional(),
  error_code: z.string().max(100).optional(),
  error_message: z.string().max(1000).optional(),
  created_by: z.string().uuid().optional(),
  retry_of_run_id: z.string().uuid().optional(),
  meta: evaluationRunMetaSchema.optional(),
});

// --- EVALUATION RUN CONTRIBUTIONS ---

export const evaluationRunContributionStatusSchema = z.enum(['identified', 'merged', 'evaluated', 'skipped']);

export const evaluationRunContributionNotesSchema = z.object({
  skipReason: z.string().optional(),
  warnings: z.array(z.string()).optional(),
}).passthrough();

export const evaluationRunContributionSchema = z.object({
  uuid: z.string().uuid(),
  run_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  status: evaluationRunContributionStatusSchema,
  notes: evaluationRunContributionNotesSchema.optional(),
  created_at: z.coerce.date(),
});

// --- EVALUATION GRIDS ---

export const evaluationGridStatusSchema = z.enum(['draft', 'published', 'archived']);
export const evaluationGridCategoryTypeSchema = z.enum(['objective', 'mixed', 'subjective', 'contextual']);

export const evaluationGridSchema = z.object({
  uuid: z.string().uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  version: z.number().int().positive(),
  status: evaluationGridStatusSchema,
  instructions: z.string().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  published_at: z.coerce.date().optional(),
  created_by: z.string().uuid().optional(),
});

export const evaluationGridCategorySchema = z.object({
  uuid: z.string().uuid(),
  grid_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  weight: z.number().min(0).max(1),
  type: evaluationGridCategoryTypeSchema,
  position: z.number().int().nonnegative(),
});

export const evaluationGridSubcriterionSchema = z.object({
  uuid: z.string().uuid(),
  category_id: z.string().uuid(),
  criterion: z.string().min(1).max(120),
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  metrics: z.array(z.string()).optional(),
  indicators: z.array(z.string()).optional(),
  scoring_excellent: z.string().optional(),
  scoring_good: z.string().optional(),
  scoring_average: z.string().optional(),
  scoring_poor: z.string().optional(),
  position: z.number().int().nonnegative(),
});

// --- SYNC MEETINGS ---

export const googleAccountSchema = z.object({
  uuid: z.string().uuid(),
  user_id: z.string().uuid(),
  google_user_id: z.string().min(1),
  display_name: z.string().min(1),
  email: z.string().email().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const syncMeetingStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'processed', 'cancelled']);

export const syncMeetingSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  challenge_id: z.string().uuid(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  meet_link: z.string().optional(),
  calendar_event_id: z.string().optional(),
  conference_id: z.string().optional(),
  conference_record_id: z.string().optional(),
  status: syncMeetingStatusSchema,
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const meetingParticipantSchema = z.object({
  uuid: z.string().uuid(),
  sync_meeting_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  google_user_id: z.string().min(1),
  display_name: z.string().min(1),
});

export const meetingAnalysisStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const decisionSchema = z.object({
  description: z.string(),
  context: z.string().optional(),
  mentioned_by: z.array(z.string()).optional(),
});

export const actionSchema = z.object({
  description: z.string(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

export const contributionSignalSchema = z.object({
  user_id: z.string().optional(),
  display_name: z.string(),
  signal_type: z.enum(['coordination', 'technical_leadership', 'problem_solving', 'knowledge_sharing']),
  weight: z.number().min(0).max(1),
  description: z.string().optional(),
});

export const meetingAnalysisSchema = z.object({
  uuid: z.string().uuid(),
  sync_meeting_id: z.string().uuid(),
  summary: z.string().optional(),
  decisions: z.array(decisionSchema).optional(),
  actions: z.array(actionSchema).optional(),
  contribution_signals: z.array(contributionSignalSchema).optional(),
  status: meetingAnalysisStatusSchema,
  processed_at: z.coerce.date().optional(),
  error_message: z.string().optional(),
  created_at: z.coerce.date(),
});

// --- ONBOARDING PROGRESS ---

export const onboardingStepSchema = z.enum([
  'clicked_challenge',
  'assigned_task',
  'evaluated_contribution',
  'validated_task',
  'joined_meeting',
]);

export const onboardingProgressSchema = z.object({
  user_id: z.string().uuid(),
  clicked_challenge: z.boolean(),
  assigned_task: z.boolean(),
  evaluated_contribution: z.boolean(),
  validated_task: z.boolean(),
  joined_meeting: z.boolean(),
  completed_at: z.coerce.date().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});
