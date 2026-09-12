import { db } from "../packages/database-service/db/drizzle.js";
import { sql } from "drizzle-orm";

/**
 * Applique les changements de schéma que `drizzle-kit push` ne peut pas
 * appliquer au déploiement. Idempotent, pensé pour tourner à chaque
 * déploiement (scalingo postdeploy), au même titre que db-resync-rewards.
 *
 * Pourquoi ce script existe plutôt qu'un `push` :
 *
 * `drizzle-kit push` compare le schéma au contenu réel de la base et doit
 * lever l'ambiguïté des colonnes déplacées — les workspace_* sont passées de
 * task_workspaces à challenge_teams, user_id de task_assignees à tasks. Il ne
 * peut pas deviner « renommage » ou « création » et pose la question via
 * promptColumnsConflicts(). Sans TTY, il échoue :
 *
 *   Error: Interactive prompts require a TTY terminal
 *     at promptColumnsConflicts (drizzle-kit/bin.cjs)
 *
 * `--force` ne couvre que les instructions de perte de données, pas cette
 * résolution-là. Aucun drapeau ne répond à la place de l'humain, donc le
 * déploiement ne peut pas s'appuyer sur push : il lui faut des instructions
 * explicites, ce que fait ce fichier.
 *
 * Ce script n'ajoute que des colonnes et des index, tous en IF NOT EXISTS. Il
 * ne supprime aucune table : task_assignees et task_workspaces restent en
 * base, plus personne ne les lit. Les supprimer est une décision séparée, et
 * destructive.
 *
 * Une exception, documentée sur place : la déduplication de challenge_teams,
 * sans laquelle l'index unique posé juste après ne peut pas être créé.
 */

const STATEMENTS: Array<{ label: string; sql: string }> = [
  // challenges.workspace_mode — c'est cette colonne qui manquait et faisait
  // échouer challenge.findAll(), donc chaque rendu de la page d'accueil.
  {
    label: "challenges.workspace_mode",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS workspace_mode varchar(20) DEFAULT 'provided_repo'`,
  },

  // challenge_teams porte désormais le workspace du contributeur, là où
  // task_workspaces le portait par tâche.
  {
    label: "challenge_teams.workspace_provider",
    sql: `ALTER TABLE challenge_teams ADD COLUMN IF NOT EXISTS workspace_provider varchar(32)`,
  },
  {
    label: "challenge_teams.workspace_ref",
    sql: `ALTER TABLE challenge_teams ADD COLUMN IF NOT EXISTS workspace_ref varchar(200)`,
  },
  {
    label: "challenge_teams.workspace_url",
    sql: `ALTER TABLE challenge_teams ADD COLUMN IF NOT EXISTS workspace_url text`,
  },
  {
    label: "challenge_teams.workspace_status",
    sql: `ALTER TABLE challenge_teams ADD COLUMN IF NOT EXISTS workspace_status varchar(20)`,
  },

  // tasks.user_id — chaque tâche appartient à un contributeur (board
  // personnel) au lieu de passer par task_assignees. NULL = tâche template.
  {
    label: "tasks.user_id",
    sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(uuid) ON DELETE CASCADE`,
  },
  {
    label: "tasks.parent_task_id",
    sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid`,
  },

  // Index déclarés dans le schéma drizzle, sans effet fonctionnel mais
  // nécessaires pour que la base corresponde à ce que le code suppose.
  {
    label: "idx_challenge_teams_challenge_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_challenge_teams_challenge_id ON challenge_teams(challenge_id)`,
  },
  {
    label: "idx_challenge_teams_user_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_challenge_teams_user_id ON challenge_teams(user_id)`,
  },
  {
    label: "idx_challenge_teams_composite",
    sql: `CREATE INDEX IF NOT EXISTS idx_challenge_teams_composite ON challenge_teams(challenge_id, user_id)`,
  },
  {
    label: "idx_tasks_user_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`,
  },
  {
    label: "idx_tasks_parent_task_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)`,
  },
  {
    label: "idx_tasks_challenge_user",
    sql: `CREATE INDEX IF NOT EXISTS idx_tasks_challenge_user ON tasks(challenge_id, user_id)`,
  },

  // tasks.type is a leftover from the very first migration: the drizzle schema
  // dropped it long ago, so no insert supplies it any more, and the column is
  // still NOT NULL with no default — every task creation fails with
  //   null value in column "type" violates not-null constraint
  // Dropping the constraint rather than the column keeps existing rows intact.
  {
    label: "tasks.type (drop leftover NOT NULL)",
    sql: `ALTER TABLE tasks ALTER COLUMN type DROP NOT NULL`,
  },

  // ── Travail en groupe (docs/input/spec-groupes-challenge.md) ──

  // NULL = participation solo, comportement inchangé. Deux rows d'un même
  // challenge partageant un group_id travaillent sur le workspace du porteur.
  {
    label: "challenge_teams.group_id",
    sql: `ALTER TABLE challenge_teams ADD COLUMN IF NOT EXISTS group_id uuid`,
  },
  {
    label: "challenge_teams.group_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_challenge_teams_group ON challenge_teams (challenge_id, group_id)`,
  },

  // Seule instruction destructive du fichier, et elle est nécessaire : la
  // table n'a jamais porté de contrainte d'unicité et le join fait un
  // check-then-insert non transactionnel, donc des doublons existent (un
  // constaté au 2026-09-05). L'index unique ci-dessous échouerait dessus.
  // La row conservée est celle qui porte un workspace — les autres sont des
  // coquilles sans branche provisionnée. Idempotent : sans doublon, no-op.
  {
    label: "challenge_teams (déduplication avant index unique)",
    sql: `
      DELETE FROM challenge_teams ct
      WHERE ct.ctid NOT IN (
        SELECT ctid FROM (
          SELECT ctid, row_number() OVER (
            PARTITION BY challenge_id, user_id
            ORDER BY (workspace_ref IS NOT NULL) DESC,
                     (workspace_url IS NOT NULL) DESC,
                     ctid
          ) AS rn
          FROM challenge_teams
        ) ranked WHERE rn = 1
      )`,
  },
  {
    label: "challenge_teams (unicité de la participation)",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_teams_unique ON challenge_teams (challenge_id, user_id)`,
  },

  // Parts de CP des membres d'un groupe. Aucune row pour une contribution
  // solo : l'absence de membres veut dire "tout revient à contributions.user_id".
  {
    label: "contribution_members",
    sql: `
      CREATE TABLE IF NOT EXISTS contribution_members (
        contribution_id uuid NOT NULL REFERENCES contributions(uuid) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        share_cp integer NOT NULL DEFAULT 0,
        CONSTRAINT contribution_members_pk PRIMARY KEY (contribution_id, user_id)
      )`,
  },
  {
    label: "contribution_members.user_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_contribution_members_user_id ON contribution_members (user_id)`,
  },

  // --- Datation pour le digest (voir docs/input/spec-digest.md §2) ---
  //
  // Les backfills ne sont pas cosmétiques : sans eux, le DEFAULT now() daterait
  // toutes les rows existantes du jour du déploiement et le premier digest les
  // listerait toutes comme nouvelles.
  //
  // Leur idempotence tient au garde `created_at >= now() - interval '1 minute'`,
  // qui ne touche que les rows que l'ADD COLUMN vient d'estampiller dans ce run.
  // Au déploiement suivant la colonne existe déjà, aucune row n'est fraîchement
  // estampillée, et l'UPDATE ne matche rien.
  {
    label: "challenges.created_at",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`,
  },
  {
    label: "challenges.created_at (backfill)",
    sql: `
      UPDATE challenges
      SET created_at = COALESCE(start_date::timestamp, timestamp '2020-01-01')
      WHERE created_at >= now() - interval '1 minute'`,
  },
  // Pas de backfill pour closed_at : aucune date de fermeture n'existe dans
  // l'historique. Les challenges déjà 'completed' n'apparaîtront dans aucun
  // digest, ce qui est assumé.
  {
    label: "challenges.closed_at",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS closed_at timestamp`,
  },
  {
    label: "contributions.created_at",
    sql: `ALTER TABLE contributions ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`,
  },
  {
    label: "contributions.created_at (backfill)",
    sql: `
      UPDATE contributions
      SET created_at = submitted_at
      WHERE created_at >= now() - interval '1 minute'`,
  },

  // --- Digest ---
  // La table est son propre curseur (period_start = period_end précédent), donc
  // rien à ajouter dans app_settings hormis les deux réglages.
  {
    label: "digests",
    sql: `
      CREATE TABLE IF NOT EXISTS digests (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        generated_at timestamp NOT NULL DEFAULT now(),
        trigger_source varchar(10) NOT NULL,
        payload jsonb NOT NULL
      )`,
  },
  {
    label: "digests.period_end (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_digests_period_end ON digests (period_end)`,
  },
  {
    label: "app_settings.digest_enabled",
    sql: `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT false`,
  },
  {
    label: "app_settings.digest_frequency_days",
    sql: `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS digest_frequency_days integer NOT NULL DEFAULT 7`,
  },

  // --- Sandbox (docs/input/spec-sandbox.md) ---
  //
  // Trois tables et deux réglages. Contrairement à drizzle/0020_sandbox.sql,
  // les FK et le CHECK sont déclarés dans le CREATE TABLE plutôt qu'en
  // ALTER TABLE ADD CONSTRAINT : Postgres n'a pas d'IF NOT EXISTS sur
  // ADD CONSTRAINT, et ce script rejoue à chaque déploiement.
  {
    label: "sandboxes",
    sql: `
      CREATE TABLE IF NOT EXISTS sandboxes (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        type varchar(10) NOT NULL,
        title varchar(255) NOT NULL,
        context text,
        goals jsonb NOT NULL DEFAULT '[]'::jsonb,
        why text,
        repo_url text NOT NULL,
        model_url text,
        dataset_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
        status varchar(10) NOT NULL DEFAULT 'open',
        promoted_challenge_id uuid REFERENCES challenges(uuid) ON DELETE SET NULL,
        promoted_at timestamp,
        evaluation jsonb,
        evaluation_status varchar(10),
        evaluated_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "sandboxes.user_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes (user_id)`,
  },
  {
    label: "sandboxes.status (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandboxes_status ON sandboxes (status)`,
  },

  // Une star anonyme n'a pas de user_id, d'où une PK de surface : une PK
  // composite (sandbox_id, user_id) ne tolérerait aucun NULL. L'unicité est
  // portée par deux index uniques partiels, un par nature d'identité.
  {
    label: "sandbox_stars",
    sql: `
      CREATE TABLE IF NOT EXISTS sandbox_stars (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sandbox_id uuid NOT NULL REFERENCES sandboxes(uuid) ON DELETE CASCADE,
        user_id uuid REFERENCES users(uuid) ON DELETE CASCADE,
        anon_id varchar(64),
        origin varchar(10) NOT NULL,
        ip_hash varchar(64),
        created_at timestamp NOT NULL DEFAULT now(),
        removed_at timestamp,
        attached_at timestamp,
        CONSTRAINT sandbox_stars_identity CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
      )`,
  },
  {
    label: "sandbox_stars (unicité par compte)",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_stars_unique_user
        ON sandbox_stars (sandbox_id, user_id) WHERE user_id IS NOT NULL`,
  },
  // Prédicat sur user_id IS NULL : une ligne rattachée garde son anon_id pour
  // l'audit, et c'est ce prédicat que l'upsert anonyme passe en ON CONFLICT.
  {
    label: "sandbox_stars (unicité par identité anonyme)",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_stars_unique_anon
        ON sandbox_stars (sandbox_id, anon_id) WHERE user_id IS NULL`,
  },
  {
    label: "sandbox_stars (comptage)",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_sandbox_stars_active
        ON sandbox_stars (sandbox_id) WHERE removed_at IS NULL`,
  },
  {
    label: "sandbox_stars.ip_hash (index de débit)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandbox_stars_ip_hash ON sandbox_stars (ip_hash, created_at)`,
  },
  {
    label: "sandbox_stars.anon_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandbox_stars_anon_id ON sandbox_stars (anon_id)`,
  },

  // Ledger séparé de reward_entries, sans colonne de cache : le total d'un
  // contributeur est un SUM en direct, donc rien à ajouter à db-resync-rewards.
  {
    label: "sandbox_rewards",
    sql: `
      CREATE TABLE IF NOT EXISTS sandbox_rewards (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sandbox_id uuid NOT NULL REFERENCES sandboxes(uuid) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        rule_key varchar(20) NOT NULL,
        tier_stars integer,
        points integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "sandbox_rewards.user_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandbox_rewards_user_id ON sandbox_rewards (user_id)`,
  },
  {
    label: "sandbox_rewards.sandbox_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandbox_rewards_sandbox_id ON sandbox_rewards (sandbox_id)`,
  },
  // Partiels : tier_stars est NULL pour une promotion, et Postgres considère
  // deux NULL comme distincts — un index global ne bloquerait rien.
  {
    label: "sandbox_rewards (un palier payé une fois)",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_rewards_unique_tier
        ON sandbox_rewards (sandbox_id, tier_stars) WHERE rule_key = 'star_tier'`,
  },
  {
    label: "sandbox_rewards (une promotion payée une fois)",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_rewards_unique_promotion
        ON sandbox_rewards (sandbox_id) WHERE rule_key = 'promotion'`,
  },

  // Défauts inertes, comme digest_enabled = false : rien n'est payé tant que
  // l'admin n'a saisi ni palier ni bonus.
  {
    label: "app_settings.sandbox_star_tiers",
    sql: `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS sandbox_star_tiers jsonb NOT NULL DEFAULT '[]'::jsonb`,
  },
  {
    label: "app_settings.sandbox_promotion_bonus_cp",
    sql: `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS sandbox_promotion_bonus_cp integer NOT NULL DEFAULT 0`,
  },

  // notifications — voir drizzle/0021_notifications.sql. La DDL vit ici en
  // double parce que `drizzle-kit push` ne peut pas tourner au déploiement
  // (prompt interactif sans TTY, cf. l'en-tête de ce fichier).
  {
    label: "notifications table",
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      uuid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
      type varchar(40) NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      dedupe_key varchar(200),
      read_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "idx_notifications_user_created",
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)`,
  },
  {
    label: "idx_notifications_unread",
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL`,
  },
  // Porte l'idempotence de l'invitation : partiel, parce que `dedupe_key` est
  // NULL pour un type sans déduplication et que deux NULL sont distincts.
  {
    label: "idx_notifications_dedupe",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications (user_id, type, dedupe_key) WHERE dedupe_key IS NOT NULL`,
  },
];

async function main() {
  console.log("🔧 Apply schema (idempotent)");

  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement.sql));
    console.log(`  ✓ ${statement.label}`);
  }

  console.log("✅ Schéma appliqué");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Volontairement fatal : si le schéma n'est pas appliqué, l'application
    // démarre pour échouer sur chaque requête. Mieux vaut un déploiement rouge
    // qu'un site en ligne qui renvoie 500 partout.
    console.error("❌ Échec de l'application du schéma :", error);
    process.exit(1);
  });
