ALTER TABLE "google_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "google_accounts" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "github_username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_user_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_google_user_id" ON "users" USING btree ("google_user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";