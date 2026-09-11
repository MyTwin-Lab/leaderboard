-- Notifications in-app. Voir docs/superpowers/specs/2026-09-11-join-group-invitations-design.md
--
-- `type` est une chaîne et non un enum : un second type de notification ne
-- doit pas demander de migration.
--
-- `payload` est dénormalisé volontairement. Une notification est la trace de
-- ce qui était vrai au moment de l'envoi ; la re-joindre à un challenge
-- renommé depuis réécrirait l'histoire, et ajouterait une jointure à une
-- liste lue à chaque affichage du profil.
--
-- `dedupe_key` porte l'idempotence : pour un `group_invite` c'est le jeton du
-- groupe, de sorte qu'inviter deux fois la même personne n'empile pas deux
-- lignes. NULL pour un type qui n'en a pas besoin.
CREATE TABLE IF NOT EXISTS "notifications" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(200),
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notifications_user_created"
  ON "notifications" USING btree ("user_id", "created_at" DESC);
--> statement-breakpoint

-- Le compteur de non-lues ne lit que cette partie de la table.
CREATE INDEX IF NOT EXISTS "idx_notifications_unread"
  ON "notifications" USING btree ("user_id")
  WHERE "read_at" IS NULL;
--> statement-breakpoint

-- Partiel parce que `dedupe_key` est NULL pour un type sans déduplication, et
-- que Postgres considère deux NULL comme distincts : un index global ne
-- contraindrait donc rien.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notifications_dedupe"
  ON "notifications" USING btree ("user_id", "type", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
