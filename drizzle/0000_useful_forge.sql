CREATE TABLE "challenge_repos" (
	"challenge_id" uuid,
	"repo_id" uuid
);
--> statement-breakpoint
CREATE TABLE "challenge_teams" (
	"challenge_id" uuid,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"index" serial NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" varchar(100) NOT NULL,
	"start_date" date,
	"end_date" date,
	"description" text,
	"roadmap" text,
	"contribution_points_reward" integer DEFAULT 0,
	"project_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text,
	"evaluation" json,
	"tags" json,
	"reward" integer DEFAULT 0,
	"user_id" uuid,
	"challenge_id" uuid
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"external_repo_id" varchar(255),
	"project_id" uuid
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"task_id" uuid,
	"user_id" uuid,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid,
	"parent_task_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar(100) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"password_hash" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD CONSTRAINT "challenge_repos_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_repos" ADD CONSTRAINT "challenge_repos_repo_id_repos_uuid_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_teams" ADD CONSTRAINT "challenge_teams_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_teams" ADD CONSTRAINT "challenge_teams_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_project_id_projects_uuid_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_project_id_projects_uuid_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_uuid_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;