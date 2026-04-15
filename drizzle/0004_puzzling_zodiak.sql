CREATE TABLE "discord_accounts" (
	"discord_id" varchar(32) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "discord_evaluations" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar(32) NOT NULL,
	"trigger_message_id" varchar(32) NOT NULL,
	"emoji" varchar(64) NOT NULL,
	"helper_discord_id" varchar(32),
	"beneficiary_discord_id" varchar(32),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"score" integer,
	"notes" json,
	"evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evaluation_grid_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grid_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"weight" real NOT NULL,
	"type" varchar(20) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_grid_subcriteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"criterion" varchar(120) NOT NULL,
	"description" text,
	"weight" real,
	"metrics" json,
	"indicators" json,
	"scoring_excellent" text,
	"scoring_good" text,
	"scoring_average" text,
	"scoring_poor" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"instructions" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published_at" timestamp,
	"created_by" uuid,
	CONSTRAINT "evaluation_grids_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "evaluation_run_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"notes" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_payload" json,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"finished_at" timestamp,
	"error_code" varchar(100),
	"error_message" text,
	"created_by" uuid,
	"meta" json
);
--> statement-breakpoint
CREATE TABLE "google_accounts" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"google_user_id" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_accounts_google_user_id_unique" UNIQUE("google_user_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_analyses" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_meeting_id" uuid NOT NULL,
	"summary" text,
	"decisions" json,
	"actions" json,
	"contribution_signals" json,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"google_user_id" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"clicked_challenge" boolean DEFAULT false NOT NULL,
	"assigned_task" boolean DEFAULT false NOT NULL,
	"evaluated_contribution" boolean DEFAULT false NOT NULL,
	"validated_task" boolean DEFAULT false NOT NULL,
	"joined_meeting" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_meetings" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"challenge_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"meet_link" text,
	"calendar_event_id" varchar(255),
	"conference_id" varchar(255),
	"conference_record_id" varchar(255),
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_workspaces" (
	"task_id" uuid,
	"repo_id" uuid,
	"workspace_provider" varchar(32),
	"workspace_ref" varchar(200),
	"workspace_url" text,
	"workspace_status" varchar(20) DEFAULT 'pending',
	"workspace_meta" json
);
--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD COLUMN "workspace_provider" varchar(32);--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD COLUMN "workspace_ref" varchar(200);--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD COLUMN "workspace_url" text;--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD COLUMN "workspace_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD COLUMN "workspace_meta" json;--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "discord_accounts" ADD CONSTRAINT "discord_accounts_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_evaluations" ADD CONSTRAINT "discord_evaluations_helper_discord_id_discord_accounts_discord_id_fk" FOREIGN KEY ("helper_discord_id") REFERENCES "public"."discord_accounts"("discord_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_evaluations" ADD CONSTRAINT "discord_evaluations_beneficiary_discord_id_discord_accounts_discord_id_fk" FOREIGN KEY ("beneficiary_discord_id") REFERENCES "public"."discord_accounts"("discord_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_grid_categories" ADD CONSTRAINT "evaluation_grid_categories_grid_id_evaluation_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."evaluation_grids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_grid_subcriteria" ADD CONSTRAINT "evaluation_grid_subcriteria_category_id_evaluation_grid_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."evaluation_grid_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_grids" ADD CONSTRAINT "evaluation_grids_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_run_contributions" ADD CONSTRAINT "evaluation_run_contributions_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_run_contributions" ADD CONSTRAINT "evaluation_run_contributions_contribution_id_contributions_uuid_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_analyses" ADD CONSTRAINT "meeting_analyses_sync_meeting_id_sync_meetings_uuid_fk" FOREIGN KEY ("sync_meeting_id") REFERENCES "public"."sync_meetings"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_sync_meeting_id_sync_meetings_uuid_fk" FOREIGN KEY ("sync_meeting_id") REFERENCES "public"."sync_meetings"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_meetings" ADD CONSTRAINT "sync_meetings_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_meetings" ADD CONSTRAINT "sync_meetings_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_task_id_tasks_uuid_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_repo_id_repos_uuid_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evaluation_grid_categories_grid_id" ON "evaluation_grid_categories" USING btree ("grid_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grid_categories_position" ON "evaluation_grid_categories" USING btree ("grid_id","position");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grid_subcriteria_category_id" ON "evaluation_grid_subcriteria" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grid_subcriteria_position" ON "evaluation_grid_subcriteria" USING btree ("category_id","position");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grids_status" ON "evaluation_grids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grids_updated_at" ON "evaluation_grids" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_evaluation_grids_slug_status" ON "evaluation_grids" USING btree ("slug","status");--> statement-breakpoint
CREATE INDEX "idx_eval_run_contributions_run_id" ON "evaluation_run_contributions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_eval_run_contributions_contribution_id" ON "evaluation_run_contributions" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "idx_eval_run_contributions_run_status" ON "evaluation_run_contributions" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "idx_evaluation_runs_challenge_id" ON "evaluation_runs" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_runs_status" ON "evaluation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_evaluation_runs_challenge_status" ON "evaluation_runs" USING btree ("challenge_id","status");--> statement-breakpoint
CREATE INDEX "idx_evaluation_runs_started_at" ON "evaluation_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_google_accounts_user_id" ON "google_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_analyses_meeting_id" ON "meeting_analyses" USING btree ("sync_meeting_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_analyses_status" ON "meeting_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_participants_meeting_id" ON "meeting_participants" USING btree ("sync_meeting_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_participants_user_id" ON "meeting_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_participants_google_user_id" ON "meeting_participants" USING btree ("google_user_id");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_challenge_id" ON "sync_meetings" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_status" ON "sync_meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_end_time" ON "sync_meetings" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_end_time_status" ON "sync_meetings" USING btree ("end_time","status");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_created_by" ON "sync_meetings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_sync_meetings_conference_record_id" ON "sync_meetings" USING btree ("conference_record_id");--> statement-breakpoint
CREATE INDEX "idx_task_workspaces_task_id" ON "task_workspaces" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_workspaces_repo_id" ON "task_workspaces" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_task_workspaces_composite" ON "task_workspaces" USING btree ("task_id","repo_id");--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_task_id_tasks_uuid_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_challenge_repos_challenge_id" ON "challenge_repos" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_repos_repo_id" ON "challenge_repos" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_repos_composite" ON "challenge_repos" USING btree ("challenge_id","repo_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_teams_challenge_id" ON "challenge_teams" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_teams_user_id" ON "challenge_teams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_teams_composite" ON "challenge_teams" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_challenges_project_id" ON "challenges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_challenges_status" ON "challenges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contributions_challenge_id" ON "contributions" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_contributions_user_id" ON "contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contributions_task_id" ON "contributions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_repos_project_id" ON "repos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_repos_external_repo_id" ON "repos" USING btree ("external_repo_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_task_id" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_user_id" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_composite" ON "task_assignees" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_challenge_id" ON "tasks" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_parent_task_id" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_challenge_status" ON "tasks" USING btree ("challenge_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_github_username" ON "users" USING btree ("github_username");