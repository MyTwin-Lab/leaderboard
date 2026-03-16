ALTER TABLE "contributions" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_task_id_tasks_uuid_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contributions_task_id" ON "contributions" USING btree ("task_id");