ALTER TABLE "meeting_participants" DROP COLUMN "participant_session_id";--> statement-breakpoint
ALTER TABLE "meeting_participants" DROP COLUMN "joined_at";--> statement-breakpoint
ALTER TABLE "meeting_participants" DROP COLUMN "left_at";--> statement-breakpoint
ALTER TABLE "meeting_utterances" DROP COLUMN "language_code";--> statement-breakpoint
ALTER TABLE "meeting_utterances" DROP COLUMN "transcript_entry_id";