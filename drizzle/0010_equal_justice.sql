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
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;