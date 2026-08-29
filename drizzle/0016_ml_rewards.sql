-- ML rewards: explicit repo roles, artifact lineage, and the reward ledger.

-- 1. Rôle explicite du repo dans le flow ML (remplace la déduction par type)
ALTER TABLE "challenge_repos"
  ADD COLUMN IF NOT EXISTS "role" varchar(20);

-- 2. Règles de reward du challenge (ML uniquement, JSON versionné)
ALTER TABLE "challenges"
  ADD COLUMN IF NOT EXISTS "reward_rules" json;

-- 3. Artefact soumis + statut d'évaluation asynchrone
ALTER TABLE "contributions"
  ADD COLUMN IF NOT EXISTS "artifact_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "evaluation_status" varchar(20);

CREATE INDEX IF NOT EXISTS "idx_contributions_artifact_url"
  ON "contributions" USING btree ("challenge_id", "artifact_url");

-- 4. Ledger append-only des attributions de points
CREATE TABLE IF NOT EXISTS "reward_entries" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contribution_id" uuid,
	"rule_key" varchar(40) NOT NULL,
	"points" integer NOT NULL,
	"source_user_id" uuid,
	"meta" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_entries" ADD CONSTRAINT "reward_entries_challenge_id_challenges_uuid_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("uuid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reward_entries" ADD CONSTRAINT "reward_entries_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reward_entries" ADD CONSTRAINT "reward_entries_contribution_id_contributions_uuid_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("uuid") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reward_entries" ADD CONSTRAINT "reward_entries_source_user_id_users_uuid_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("uuid") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reward_entries_challenge_id" ON "reward_entries" USING btree ("challenge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reward_entries_user_id" ON "reward_entries" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reward_entries_contribution_id" ON "reward_entries" USING btree ("contribution_id");
--> statement-breakpoint

-- 5. Backfill des rôles, en reproduisant exactement l'heuristique positionnelle
--    qui vivait dans MLChallengeFlow.assignReposToSteps :
--      - kaggle_dataset            -> dataset
--      - kaggle_model              -> model
--      - github, si le challenge a un kaggle_model -> api
--      - github, sinon : le 1er (par repo_id) -> model, les suivants -> api
--    Les challenges non-ML gardent role = NULL : le rôle ne les concerne pas.

UPDATE "challenge_repos" cr
SET "role" = 'dataset'
FROM "repos" r
WHERE cr."repo_id" = r."uuid" AND r."type" = 'kaggle_dataset' AND cr."role" IS NULL;

UPDATE "challenge_repos" cr
SET "role" = 'model'
FROM "repos" r
WHERE cr."repo_id" = r."uuid" AND r."type" = 'kaggle_model' AND cr."role" IS NULL;

-- github sur un challenge qui a un kaggle_model -> api
UPDATE "challenge_repos" cr
SET "role" = 'api'
FROM "repos" r
WHERE cr."repo_id" = r."uuid"
  AND r."type" = 'github'
  AND cr."role" IS NULL
  AND EXISTS (
    SELECT 1 FROM "challenge_repos" cr2
    JOIN "repos" r2 ON cr2."repo_id" = r2."uuid"
    WHERE cr2."challenge_id" = cr."challenge_id" AND r2."type" = 'kaggle_model'
  )
  AND EXISTS (
    SELECT 1 FROM "challenges" c
    WHERE c."uuid" = cr."challenge_id" AND c."type" = 'ml'
  );

-- github sur un challenge ML sans kaggle_model : le premier devient le modèle
UPDATE "challenge_repos" cr
SET "role" = 'model'
WHERE cr."role" IS NULL
  AND EXISTS (
    SELECT 1 FROM "challenges" c
    WHERE c."uuid" = cr."challenge_id" AND c."type" = 'ml'
  )
  AND cr."repo_id" = (
    SELECT cr2."repo_id" FROM "challenge_repos" cr2
    JOIN "repos" r2 ON cr2."repo_id" = r2."uuid"
    WHERE cr2."challenge_id" = cr."challenge_id" AND r2."type" = 'github'
    ORDER BY cr2."repo_id"
    LIMIT 1
  );

-- les github ML restants -> api
UPDATE "challenge_repos" cr
SET "role" = 'api'
FROM "repos" r
WHERE cr."repo_id" = r."uuid"
  AND r."type" = 'github'
  AND cr."role" IS NULL
  AND EXISTS (
    SELECT 1 FROM "challenges" c
    WHERE c."uuid" = cr."challenge_id" AND c."type" = 'ml'
  );

-- 6. Backfill de artifact_url depuis description, qui servait de stockage d'URL
--    dans le flow ML (ml-workspace écrivait l'URL brute dans description).
UPDATE "contributions"
SET "artifact_url" = lower(regexp_replace(trim("description"), '/+$', ''))
WHERE "artifact_url" IS NULL
  AND "description" ~ '^https?://[^[:space:]]+$';
