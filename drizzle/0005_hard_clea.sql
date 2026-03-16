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
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_task_id_tasks_uuid_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_repo_id_repos_uuid_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("uuid") ON DELETE cascade ON UPDATE no action;