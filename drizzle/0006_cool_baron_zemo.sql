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
	"key_points" json,
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
	"display_name" varchar(255) NOT NULL,
	"participant_session_id" varchar(255),
	"joined_at" timestamp,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "meeting_utterances" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_meeting_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"text" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"language_code" varchar(10),
	"transcript_entry_id" varchar(255)
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
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_analyses" ADD CONSTRAINT "meeting_analyses_sync_meeting_id_sync_meetings_uuid_fk" FOREIGN KEY ("sync_meeting_id") REFERENCES "public"."sync_meetings"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_sync_meeting_id_sync_meetings_uuid_fk" FOREIGN KEY ("sync_meeting_id") REFERENCES "public"."sync_meetings"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_utterances" ADD CONSTRAINT "meeting_utterances_sync_meeting_id_sync_meetings_uuid_fk" FOREIGN KEY ("sync_meeting_id") REFERENCES "public"."sync_meetings"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_utterances" ADD CONSTRAINT "meeting_utterances_participant_id_meeting_participants_uuid_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."meeting_participants"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_meetings" ADD CONSTRAINT "sync_meetings_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_meetings" ADD CONSTRAINT "sync_meetings_created_by_users_uuid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uuid") ON DELETE no action ON UPDATE no action;