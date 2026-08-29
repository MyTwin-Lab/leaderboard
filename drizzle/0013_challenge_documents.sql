CREATE TABLE "challenge_documents" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "challenge_documents" ADD CONSTRAINT "challenge_documents_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_documents" ADD CONSTRAINT "challenge_documents_uploaded_by_users_uuid_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("uuid") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_challenge_documents_challenge_id" ON "challenge_documents" USING btree ("challenge_id");
