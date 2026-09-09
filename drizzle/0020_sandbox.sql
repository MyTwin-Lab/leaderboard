-- Sandbox : propositions ouvertes déposées par les contributeurs, leurs stars
-- et les CP qu'elles paient. Voir docs/input/spec-sandbox.md et docs/sandbox.md.

-- 1. La proposition
--
-- Délibérément décorrélée de `challenges` : pas de pool, pas de membres, pas de
-- tâches, pas de cycle draft→active→completed. Seul l'auteur y travaille.
--
-- `promoted_challenge_id` est en SET NULL et non en CASCADE : supprimer le
-- challenge issu d'une promotion ne doit pas emporter la proposition qui lui a
-- donné naissance, ni les CP qu'elle a payés.
--
-- L'évaluation vit sur la row et non dans `contributions` : elle est formative,
-- ne rapporte aucun CP, et ne doit toucher ni le ledger ni le leaderboard.
CREATE TABLE IF NOT EXISTS "sandboxes" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"title" varchar(255) NOT NULL,
	"context" text,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why" text,
	"repo_url" text NOT NULL,
	"model_url" text,
	"dataset_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"promoted_challenge_id" uuid,
	"promoted_at" timestamp,
	"evaluation" jsonb,
	"evaluation_status" varchar(10),
	"evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "sandboxes"
  ADD CONSTRAINT "sandboxes_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "sandboxes"
  ADD CONSTRAINT "sandboxes_promoted_challenge_id_challenges_uuid_fk"
  FOREIGN KEY ("promoted_challenge_id") REFERENCES "public"."challenges"("uuid")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sandboxes_user_id"
  ON "sandboxes" USING btree ("user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sandboxes_status"
  ON "sandboxes" USING btree ("status");
--> statement-breakpoint

-- 2. Les stars
--
-- Un visiteur non connecté peut starer, et sa star paie les paliers au même
-- titre que celle d'un compte : c'est ce qui permettra de liker un sandbox
-- depuis une newsletter.
--
-- D'où une clé primaire de surface plutôt que (sandbox_id, user_id) : une star
-- anonyme n'a pas de user_id, et une PK composite ne tolère aucun NULL.
--
-- `removed_at` : unstarer est un soft-delete. Un palier payé n'est jamais
-- repris, donc une vague star → unstar doit laisser une trace exploitable, et
-- le rate-limit continue de compter sur `created_at`.
CREATE TABLE IF NOT EXISTS "sandbox_stars" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"user_id" uuid,
	"anon_id" varchar(64),
	"origin" varchar(10) NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"attached_at" timestamp,
	-- Une ligne sans aucune identité ne serait rattachable à personne et
	-- fausserait le compteur sans laisser de trace exploitable.
	CONSTRAINT "sandbox_stars_identity" CHECK ("user_id" IS NOT NULL OR "anon_id" IS NOT NULL)
);
--> statement-breakpoint

ALTER TABLE "sandbox_stars"
  ADD CONSTRAINT "sandbox_stars_sandbox_id_sandboxes_uuid_fk"
  FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "sandbox_stars"
  ADD CONSTRAINT "sandbox_stars_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Unicité par nature d'identité. Les index sont partiels parce que Postgres
-- considère deux NULL comme distincts : un index unique global sur
-- (sandbox_id, user_id) ne contraindrait rien du côté anonyme.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_stars_unique_user"
  ON "sandbox_stars" USING btree ("sandbox_id", "user_id")
  WHERE "user_id" IS NOT NULL;
--> statement-breakpoint

-- Prédicat sur `user_id IS NULL` et non sur `anon_id IS NOT NULL` : une ligne
-- rattachée à un compte garde son anon_id (trace d'audit), et deux
-- rattachements successifs du même navigateur doivent pouvoir coexister.
-- C'est aussi ce prédicat que l'upsert anonyme passe en ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_stars_unique_anon"
  ON "sandbox_stars" USING btree ("sandbox_id", "anon_id")
  WHERE "user_id" IS NULL;
--> statement-breakpoint

-- Comptage : le listing ne lit que les stars vivantes.
CREATE INDEX IF NOT EXISTS "idx_sandbox_stars_active"
  ON "sandbox_stars" USING btree ("sandbox_id")
  WHERE "removed_at" IS NULL;
--> statement-breakpoint

-- Rate-limit : compte les stars créées derrière une IP sur la dernière heure.
-- L'IP sert au débit et jamais à l'unicité — un campus sort derrière une seule
-- adresse, et de vrais utilisateurs se bloqueraient mutuellement.
CREATE INDEX IF NOT EXISTS "idx_sandbox_stars_ip_hash"
  ON "sandbox_stars" USING btree ("ip_hash", "created_at");
--> statement-breakpoint

-- Rattachement des stars anonymes au compte, à la connexion.
CREATE INDEX IF NOT EXISTS "idx_sandbox_stars_anon_id"
  ON "sandbox_stars" USING btree ("anon_id");
--> statement-breakpoint

-- 3. Le ledger des CP sandbox
--
-- Table à part, et pas deux rule_key de plus dans `reward_entries` :
-- `reward_entries.challenge_id` est NOT NULL et tout le leaderboard y agrège
-- par contribution. Un sandbox n'a ni challenge ni contribution, et n'a pas à
-- en simuler.
--
-- Aucune colonne de cache, pas d'équivalent de `contributions.reward` : le
-- total d'un contributeur est toujours un SUM en direct. Supprimer une ligne
-- *est* donc la reprise des CP, et db-resync-rewards n'a rien à connaître d'ici.
CREATE TABLE IF NOT EXISTS "sandbox_rewards" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_key" varchar(20) NOT NULL,
	"tier_stars" integer,
	"points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "sandbox_rewards"
  ADD CONSTRAINT "sandbox_rewards_sandbox_id_sandboxes_uuid_fk"
  FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "sandbox_rewards"
  ADD CONSTRAINT "sandbox_rewards_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sandbox_rewards_user_id"
  ON "sandbox_rewards" USING btree ("user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sandbox_rewards_sandbox_id"
  ON "sandbox_rewards" USING btree ("sandbox_id");
--> statement-breakpoint

-- Un palier n'est payé qu'une fois par sandbox : les cycles star/unstar ne
-- peuvent pas payer deux fois, et deux stars concurrentes franchissant le même
-- seuil produisent exactement une ligne (ON CONFLICT DO NOTHING sur cet index).
-- Partiel parce que `tier_stars` est NULL pour une promotion.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_rewards_unique_tier"
  ON "sandbox_rewards" USING btree ("sandbox_id", "tier_stars")
  WHERE "rule_key" = 'star_tier';
--> statement-breakpoint

-- Un sandbox promu, et payé, une seule fois. C'est la ceinture de la garde
-- `UPDATE … WHERE status = 'open'` qui ouvre la transaction de promotion.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_rewards_unique_promotion"
  ON "sandbox_rewards" USING btree ("sandbox_id")
  WHERE "rule_key" = 'promotion';
--> statement-breakpoint

-- 4. Réglages de l'économie sandbox
--
-- Défauts inertes, dans l'esprit de `digest_enabled = false` : tant que l'admin
-- n'a saisi ni palier ni bonus, starer et promouvoir ne distribuent aucun CP.
-- Une instance existante ne se met donc pas à payer toute seule au déploiement.
ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "sandbox_star_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint

ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "sandbox_promotion_bonus_cp" integer DEFAULT 0 NOT NULL;
