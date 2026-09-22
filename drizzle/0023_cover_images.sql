-- Les images de couverture des challenges et des propositions sandbox.
--
-- Miroir documentaire. En production, c'est scripts/db-apply-schema.ts qui
-- applique ces changements.
--
-- Deux ajouts :
--  - une colonne `cover_image_url` sur `challenges` et sur `sandboxes` ;
--  - une table `images`, qui porte les fichiers déposés depuis l'app. Le Lab
--    n'a pas de stockage objet, et le volume attendu (quelques dizaines de
--    fichiers de quelques centaines de ko, réduits par l'interface avant
--    l'envoi) ne le justifie pas.

CREATE TABLE IF NOT EXISTS "images" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "public"."users"("uuid") ON DELETE set null,
	"mime_type" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_images_user_id" ON "images" USING btree ("user_id");
--> statement-breakpoint

ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
--> statement-breakpoint

ALTER TABLE "sandboxes" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
