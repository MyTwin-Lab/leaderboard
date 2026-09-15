-- Slugs des URLs publiques : /challenges/<slug> et /sandbox/<slug>.
-- Voir docs/superpowers/plans/2026-09-15-slug-urls.md.
--
-- Miroir documentaire. En production, c'est scripts/db-apply-schema.ts qui
-- applique ces changements : le backfill y est calculé en TypeScript, avec le
-- même slugify que l'interface (domain/slug.ts), ce que ce fichier ne peut pas
-- faire. Sur une base qui a déjà des lignes, lancer `npm run db:apply-schema`
-- plutôt que ce fichier : les ALTER ... SET NOT NULL ci-dessous échoueraient
-- sur des slugs encore vides.

-- Les anciens slugs, gardés en redirection vers la ligne qui les portait.
CREATE TABLE IF NOT EXISTS "challenge_slug_redirects" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"challenge_id" uuid NOT NULL REFERENCES "public"."challenges"("uuid") ON DELETE cascade,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_challenge_slug_redirects_challenge_id"
  ON "challenge_slug_redirects" USING btree ("challenge_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sandbox_slug_redirects" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL REFERENCES "public"."sandboxes"("uuid") ON DELETE cascade,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sandbox_slug_redirects_sandbox_id"
  ON "sandbox_slug_redirects" USING btree ("sandbox_id");
--> statement-breakpoint

ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "slug" varchar(80);
--> statement-breakpoint

-- (backfill : scripts/db-apply-schema.ts, slugStatement)

ALTER TABLE "challenges" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_challenges_slug" ON "challenges" USING btree ("slug");
--> statement-breakpoint

ALTER TABLE "sandboxes" ADD COLUMN IF NOT EXISTS "slug" varchar(80);
--> statement-breakpoint

ALTER TABLE "sandboxes" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandboxes_slug" ON "sandboxes" USING btree ("slug");
