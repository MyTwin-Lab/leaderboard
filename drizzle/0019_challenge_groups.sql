-- Travail en groupe sur un challenge : appartenance au groupe et parts de CP.
-- Voir docs/input/spec-groupes-challenge.md

-- 1. Déduplication préalable de challenge_teams
--
-- La table n'a jamais porté de contrainte d'unicité et le join fait un
-- check-then-insert non transactionnel : deux POST simultanés ont pu produire
-- deux rows pour le même (challenge, contributeur). L'index unique posé en 3
-- échouerait dessus, donc on nettoie d'abord.
--
-- La row conservée est celle qui porte un workspace (ref puis url) : c'est
-- celle dont la branche a été provisionnée, les autres sont des coquilles.
-- `ctid` départage le reste — la table n'a pas de clé primaire à utiliser.
DELETE FROM "challenge_teams" ct
WHERE ct.ctid NOT IN (
  SELECT ctid FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY challenge_id, user_id
        ORDER BY
          (workspace_ref IS NOT NULL) DESC,
          (workspace_url IS NOT NULL) DESC,
          ctid
      ) AS rn
    FROM "challenge_teams"
  ) ranked
  WHERE rn = 1
);
--> statement-breakpoint

-- 2. Appartenance au groupe
--
-- NULL = participation solo, comportement strictement inchangé. Deux rows du
-- même challenge partageant un group_id forment un groupe. Détruire un groupe,
-- c'est remettre ses group_id à NULL.
ALTER TABLE "challenge_teams"
  ADD COLUMN IF NOT EXISTS "group_id" uuid;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_challenge_teams_group"
  ON "challenge_teams" USING btree ("challenge_id", "group_id");
--> statement-breakpoint

-- 3. Un contributeur ne participe qu'une fois à un challenge
--
-- Ferme la course du double-join. Ne contraint pas les rows orphelines
-- (challenge_id ou user_id NULL) : Postgres considère les NULL comme
-- distincts, ce qui est le comportement voulu ici.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_challenge_teams_unique"
  ON "challenge_teams" USING btree ("challenge_id", "user_id");
--> statement-breakpoint

-- 4. Part de CP de chaque membre sur une contribution de groupe
--
-- Aucune row pour une contribution solo : l'absence de membres signifie
-- "tout le reward revient à contributions.user_id", donc le comportement
-- actuel reste intact sans migration de données.
--
-- share_cp est cumulatif : le scoring de `code` est itératif, chaque run
-- ajoute son delta à la part existante (voir contributionMember.repo.ts).
-- L'invariant Σ share_cp = contributions.reward tient en permanence.
CREATE TABLE IF NOT EXISTS "contribution_members" (
	"contribution_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_cp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contribution_members_pk" PRIMARY KEY ("contribution_id", "user_id")
);
--> statement-breakpoint

ALTER TABLE "contribution_members"
  ADD CONSTRAINT "contribution_members_contribution_id_contributions_uuid_fk"
  FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "contribution_members"
  ADD CONSTRAINT "contribution_members_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Le leaderboard lit les parts par contributeur : la PK ne couvre pas ce sens.
CREATE INDEX IF NOT EXISTS "idx_contribution_members_user_id"
  ON "contribution_members" USING btree ("user_id");
