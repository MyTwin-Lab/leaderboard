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
