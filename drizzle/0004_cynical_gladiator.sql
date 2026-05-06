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
ALTER TABLE "evaluation_grid_categories" ADD CONSTRAINT "evaluation_grid_categories_grid_id_evaluation_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."evaluation_grids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_grid_subcriteria" ADD CONSTRAINT "evaluation_grid_subcriteria_category_id_evaluation_grid_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."evaluation_grid_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_grids" ADD CONSTRAINT "evaluation_grids_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_run_contributions" ADD CONSTRAINT "evaluation_run_contributions_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_run_contributions" ADD CONSTRAINT "evaluation_run_contributions_contribution_id_contributions_uuid_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;