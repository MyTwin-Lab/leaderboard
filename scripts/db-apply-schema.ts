import { db } from "../packages/database-service/db/drizzle.js";
import { sql } from "drizzle-orm";
import { SLUG_FALLBACK, planSlugBackfill } from "../packages/database-service/domain/slug.js";

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
 *
 * Depuis M6, il réécrit aussi des contraintes de clé étrangère (passage en
 * ON DELETE SET NULL) et vide des tokens déjà expirés. Les deux restent
 * idempotents : un second passage ne trouve plus rien à modifier.
 */

/**
 * FK `<table>.<column> → users(uuid)` passée en ON DELETE SET NULL.
 *
 * Postgres n'a ni `ADD CONSTRAINT IF NOT EXISTS` ni `ALTER CONSTRAINT … ON
 * DELETE`, d'où ce bloc DO :
 *   1. on retrouve la contrainte par sa colonne plutôt que par son nom — les
 *      bases créées à différentes époques (migrations drizzle/, push) ne
 *      l'ont pas forcément nommée pareil ;
 *   2. on ne supprime que celles dont l'action n'est pas déjà SET NULL
 *      (`confdeltype <> 'n'`) ;
 *   3. on n'ajoute la nouvelle que s'il n'en reste aucune en SET NULL.
 * Au second passage, l'étape 2 ne trouve rien et l'étape 3 non plus : no-op.
 *
 * Gardé sur l'existence de la colonne (`to_regclass` rend NULL sans lever
 * d'erreur), pour la même raison que le bloc tasks.type : ce script est fatal,
 * une table absente ne doit pas bloquer tout ce qui suit.
 */
function fkSetNullStatement(table: string, column: string): { label: string; sql: string } {
  const constraintName = `${table}_${column}_users_uuid_fk`;
  const matchingFk = `
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.contype = 'f'
            AND c.conrelid = to_regclass('${table}')
            AND c.confrelid = 'users'::regclass
            AND array_length(c.conkey, 1) = 1
            AND a.attname = '${column}'`;
  return {
    label: `${table}.${column} (FK users ON DELETE SET NULL)`,
    sql: `
      DO $$
      DECLARE
        fk record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = to_regclass('${table}') AND attname = '${column}' AND NOT attisdropped
        ) THEN
          RETURN;
        END IF;

        FOR fk IN
          SELECT c.conname ${matchingFk}
            AND c.confdeltype <> 'n'
        LOOP
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${table}', fk.conname);
        END LOOP;

        IF NOT EXISTS (
          SELECT 1 ${matchingFk}
            AND c.confdeltype = 'n'
        ) THEN
          ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${column}) REFERENCES users(uuid) ON DELETE SET NULL;
        END IF;
      END $$`,
  };
}

/**
 * Les slugs d'une table (challenges ou sandboxes) : backfill, NOT NULL et
 * index unique, dans **une** transaction.
 *
 * Pourquoi en TypeScript et pas en SQL : le slug est calculé par
 * `planSlugBackfill`, avec le même `slugify` que l'interface. Postgres n'a pas
 * de translittération sans l'extension `unaccent`, et deux implémentations
 * finiraient par diverger — la prod recevrait des slugs que l'UI n'aurait
 * jamais proposés.
 *
 * Pourquoi une transaction avec verrou : le postdeploy Scalingo tourne pendant
 * que l'ancienne version sert encore le trafic, et elle crée des lignes sans
 * slug. `SHARE ROW EXCLUSIVE` bloque les écritures (pas les lectures) le temps
 * du backfill ; sans lui, une ligne insérée entre le SELECT et le SET NOT NULL
 * ferait échouer le déploiement. Tout ou rien : en cas d'échec la colonne reste
 * nullable et l'ancien code continue de fonctionner.
 *
 * Idempotent : une colonne déjà NOT NULL court-circuite tout, sans verrou.
 */
function slugStatement(
  table: "challenges" | "sandboxes",
  redirectsTable: "challenge_slug_redirects" | "sandbox_slug_redirects",
): { label: string; run: () => Promise<void> } {
  const indexName = `idx_${table}_slug`;
  return {
    label: `${table}.slug (backfill, NOT NULL, unicité)`,
    run: async () => {
      const { rows: columns } = await db.execute(sql`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = 'slug'`);
      if (columns[0]?.is_nullable === "NO") {
        await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} (slug)`));
        return;
      }

      await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`));

        const { rows } = await tx.execute(sql.raw(
          `SELECT uuid, title, slug FROM ${table} ORDER BY created_at, uuid`,
        ));
        const { rows: redirects } = await tx.execute(sql.raw(`SELECT slug FROM ${redirectsTable}`));

        const plan = planSlugBackfill(
          rows as Array<{ uuid: string; title: string; slug: string | null }>,
          table === "challenges" ? SLUG_FALLBACK.challenge : SLUG_FALLBACK.sandbox,
          (redirects as Array<{ slug: string }>).map((row) => row.slug),
        );
        // La trace du déploiement : quel identifiant a reçu quel slug.
        for (const { uuid, slug } of plan) {
          await tx.execute(sql`UPDATE ${sql.raw(table)} SET slug = ${slug} WHERE uuid = ${uuid}`);
          console.log(`      ${uuid} → ${slug}`);
        }

        await tx.execute(sql.raw(`ALTER TABLE ${table} ALTER COLUMN slug SET NOT NULL`));
        await tx.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} (slug)`));
      });
    },
  };
}

const STATEMENTS: Array<{ label: string; sql: string } | { label: string; run: () => Promise<void> }> = [
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
  //
  // Gardé sur information_schema parce qu'une base créée depuis le schéma
  // drizzle actuel (drizzle-kit push, tout poste neuf) n'a JAMAIS eu cette
  // colonne : l'ALTER y échouait alors en 42703 « la colonne "type" de la
  // relation "tasks" n'existe pas ». Ce script étant fatal par conception,
  // il s'arrêtait là et aucune des instructions suivantes n'était appliquée —
  // y compris les tables les plus récentes, tout en fin de tableau. Postgres
  // n'offre pas d'IF EXISTS sur ALTER COLUMN ... DROP NOT NULL, d'où le bloc DO.
  {
    label: "tasks.type (drop leftover NOT NULL)",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tasks' AND column_name = 'type'
        ) THEN
          ALTER TABLE tasks ALTER COLUMN type DROP NOT NULL;
        END IF;
      END $$`,
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
        type varchar(64) NOT NULL,
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

  // --- Challenges de validation en mode scénario (source = challenge `code`) ---
  // Le mode n'est pas stocké : il se déduit du type du challenge source. Ces
  // trois tables ne portent donc aucune colonne de mode.
  {
    label: "validation_scenario_steps",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_scenario_steps (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        validation_challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        position integer NOT NULL DEFAULT 0,
        title varchar(255) NOT NULL,
        instructions text,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_scenario_steps_challenge_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_steps_challenge_id ON validation_scenario_steps (validation_challenge_id, position)`,
  },
  {
    label: "validation_scenario_runs",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_scenario_runs (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        validation_challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        contribution_id uuid NOT NULL REFERENCES contributions(uuid) ON DELETE CASCADE,
        validator_user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        global_feedback text,
        completed_at timestamp,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_scenario_runs_challenge_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_runs_challenge_id ON validation_scenario_runs (validation_challenge_id)`,
  },
  {
    label: "idx_validation_scenario_runs_validator_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_runs_validator_id ON validation_scenario_runs (validator_user_id)`,
  },
  // Porte la garantie « une walkthrough par (validateur, application) », donc
  // « cp_per_validation payé une fois ». C'est la base qui l'applique, pas
  // l'application : deux requêtes concurrentes se départagent ici.
  {
    label: "idx_validation_scenario_runs_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_scenario_runs_unique ON validation_scenario_runs (validation_challenge_id, contribution_id, validator_user_id)`,
  },
  {
    label: "validation_step_feedbacks",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_step_feedbacks (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id uuid NOT NULL REFERENCES validation_scenario_runs(uuid) ON DELETE CASCADE,
        step_id uuid NOT NULL REFERENCES validation_scenario_steps(uuid) ON DELETE CASCADE,
        result varchar(10) NOT NULL,
        comment text,
        medical_comment text,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_step_feedbacks_run_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_step_feedbacks_run_id ON validation_step_feedbacks (run_id)`,
  },
  // La cible du ON CONFLICT de StepFeedbackRepository.upsert.
  {
    label: "idx_validation_step_feedbacks_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_step_feedbacks_unique ON validation_step_feedbacks (run_id, step_id)`,
  },

  // --- Audit des rôles (L8) ---
  // Une row par changement effectif, écrite dans la transaction de l'UPDATE
  // (UserRepository.updateRole). old_role NULL = rôle attribué à la création.
  {
    label: "role_changes",
    sql: `
      CREATE TABLE IF NOT EXISTS role_changes (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        old_role varchar(100),
        new_role varchar(100) NOT NULL,
        changed_by uuid REFERENCES users(uuid) ON DELETE SET NULL,
        note text,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "idx_role_changes_user_created",
    sql: `CREATE INDEX IF NOT EXISTS idx_role_changes_user_created ON role_changes (user_id, created_at)`,
  },

  // --- Suppression de compte (M6) ---
  // Ces FK n'avaient pas d'action ON DELETE : elles bloquaient la suppression
  // de tout admin ou manager ayant décidé, créé ou connecté quelque chose.
  //
  // DROP NOT NULL d'abord : un SET NULL sur une colonne NOT NULL passerait à
  // la création mais échouerait à la première suppression. DROP NOT NULL sur
  // une colonne déjà nullable est un no-op, sans erreur.
  {
    label: "sync_meetings.created_by (drop NOT NULL)",
    sql: `
      DO $$
      BEGIN
        IF to_regclass('sync_meetings') IS NOT NULL THEN
          ALTER TABLE sync_meetings ALTER COLUMN created_by DROP NOT NULL;
        END IF;
      END $$`,
  },
  fkSetNullStatement("compute_requests", "decided_by"),
  fkSetNullStatement("evaluation_runs", "created_by"),
  fkSetNullStatement("evaluation_grids", "created_by"),
  fkSetNullStatement("app_settings", "updated_by"),
  fkSetNullStatement("app_settings", "github_connected_by"),
  fkSetNullStatement("app_settings", "kaggle_connected_by"),
  fkSetNullStatement("app_settings", "openai_connected_by"),
  fkSetNullStatement("app_settings", "slack_connected_by"),
  fkSetNullStatement("app_settings", "scaleway_connected_by"),
  fkSetNullStatement("sync_meetings", "created_by"),

  // --- Rétention des pièces de validation (L9) ---
  // NULL = octets intacts. La purge elle-même vit côté application.
  {
    label: "validation_reference_cases.purged_at",
    sql: `ALTER TABLE validation_reference_cases ADD COLUMN IF NOT EXISTS purged_at timestamp`,
  },
  {
    label: "validation_case_claims.purged_at",
    sql: `ALTER TABLE validation_case_claims ADD COLUMN IF NOT EXISTS purged_at timestamp`,
  },

  // --- Poids individuels des réunions de synchro (H4) ---
  // SPEC challenge 008, §9 : aucune utilisation à des fins d'évaluation
  // individuelle. L'agent ne produit plus ces signaux et plus aucun code ne lit
  // la colonne ; on supprime aussi les poids déjà stockés. Destructif, mais
  // c'est précisément le but. Idempotent : IF EXISTS, no-op au second passage.
  {
    label: "meeting_analyses.contribution_signals (suppression)",
    sql: `ALTER TABLE meeting_analyses DROP COLUMN IF EXISTS contribution_signals`,
  },

  // --- Token Jupyter des instances GPU (M9) ---
  // Rattrapage des lignes terminées avant que updateExpired/updateFailed ne
  // vident le token. Idempotent : le filtre IS NOT NULL ne matche plus rien
  // au second passage.
  {
    label: "compute_requests.access_token (purge des demandes terminées)",
    sql: `
      UPDATE compute_requests
      SET access_token_enc = NULL, access_token_iv = NULL
      WHERE status IN ('expired', 'failed', 'rejected')
        AND access_token_enc IS NOT NULL`,
  },

  // --- Cache contributions.reward (drizzle/0018) ---
  // Le trigger n'existait que dans la migration drizzle/0018, jamais appliquée
  // par ce script : sans lui, createManyAndSyncRewards écrit le ledger mais
  // contributions.reward reste à 0 jusqu'au prochain db-resync-rewards.
  // Idempotent : CREATE OR REPLACE pour la fonction, DROP IF EXISTS puis
  // CREATE pour le trigger. Pas de backfill ici — db-resync-rewards tourne
  // juste après dans le postdeploy et recale les caches déjà dérivés.
  {
    label: "sync_contribution_reward() (fonction)",
    sql: `
      CREATE OR REPLACE FUNCTION sync_contribution_reward() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.contribution_id IS NOT NULL THEN
            UPDATE contributions
            SET reward = COALESCE(
              (SELECT SUM(points) FROM reward_entries WHERE contribution_id = OLD.contribution_id), 0
            )
            WHERE uuid = OLD.contribution_id;
          END IF;
          RETURN OLD;
        END IF;

        IF NEW.contribution_id IS NOT NULL THEN
          UPDATE contributions
          SET reward = COALESCE(
            (SELECT SUM(points) FROM reward_entries WHERE contribution_id = NEW.contribution_id), 0
          )
          WHERE uuid = NEW.contribution_id;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.contribution_id IS DISTINCT FROM NEW.contribution_id
           AND OLD.contribution_id IS NOT NULL THEN
          UPDATE contributions
          SET reward = COALESCE(
            (SELECT SUM(points) FROM reward_entries WHERE contribution_id = OLD.contribution_id), 0
          )
          WHERE uuid = OLD.contribution_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`,
  },
  {
    label: "trg_sync_contribution_reward (suppression avant recréation)",
    sql: `DROP TRIGGER IF EXISTS trg_sync_contribution_reward ON reward_entries`,
  },
  {
    label: "trg_sync_contribution_reward",
    sql: `
      CREATE TRIGGER trg_sync_contribution_reward
      AFTER INSERT OR UPDATE OR DELETE ON reward_entries
      FOR EACH ROW
      EXECUTE FUNCTION sync_contribution_reward()`,
  },

  // --- Runs d'évaluation écrits par la capacité evaluate (challenge 020, L2) ---
  // Chaque évaluation trace un run : celle d'un sandbox n'a pas de challenge,
  // et aucune n'a la fenêtre temporelle de l'ancien pipeline de synchro.
  // DROP NOT NULL sur une colonne déjà nullable est un no-op, sans erreur.
  {
    label: "evaluation_runs.challenge_id, window_start, window_end (drop NOT NULL)",
    sql: `
      ALTER TABLE evaluation_runs
        ALTER COLUMN challenge_id DROP NOT NULL,
        ALTER COLUMN window_start DROP NOT NULL,
        ALTER COLUMN window_end DROP NOT NULL`,
  },

  // --- Configuration des flows (challenge 020, L3) ---
  // `flow_config` reprend workspace_mode (code), compute_enabled (extension
  // compute du flow ML) et cp_per_validation / required_validations
  // (validation), en version 1. Les quatre colonnes restent en place et
  // écrites en miroir jusqu'au lot L7. Idempotent : seules les lignes sans
  // configuration sont reprises. Même correspondance que
  // packages/database-service/domain/legacyFlowConfig.ts.
  {
    label: "challenges.flow_config",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS flow_config jsonb`,
  },
  {
    label: "challenges.flow_config_version",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS flow_config_version integer NOT NULL DEFAULT 1`,
  },
  {
    label: "challenges.flow_config (reprise des colonnes historiques)",
    sql: `
      UPDATE challenges SET
        flow_config = CASE COALESCE(type, 'code')
          WHEN 'code' THEN jsonb_build_object('workspace_mode', COALESCE(workspace_mode, 'provided_repo'))
          WHEN 'ml' THEN jsonb_build_object('extensions',
            jsonb_build_object('compute', jsonb_build_object('enabled', COALESCE(compute_enabled, false))))
          WHEN 'validation' THEN jsonb_strip_nulls(jsonb_build_object('cp_per_validation', cp_per_validation))
            || jsonb_build_object('required_validations', required_validations)
          ELSE '{}'::jsonb
        END,
        flow_config_version = 1
      WHERE flow_config IS NULL`,
  },

  // --- Scission de la validation (challenge 020, L3) ---
  // `validation` devient `endpoint-validation` (source ML : cas de référence)
  // ou `journey-validation` (source code : parcours de scénario), et un
  // parcours perd le quorum qu'il n'a jamais eu. Sans source lisible, le type
  // se déduit des tables filles ; si aucune ne tranche (ni l'une ni l'autre, ou
  // les deux), la reprise s'arrête et liste les challenges à décider à la main.
  // Idempotent : plus aucune ligne `validation` au second passage.
  {
    label: "challenges.type (validation → endpoint-validation / journey-validation)",
    run: async () => {
      const decided = sql`CASE
        WHEN (SELECT s.type FROM challenges s WHERE s.uuid = c.source_challenge_id) = 'ml' THEN 'endpoint-validation'
        WHEN (SELECT s.type FROM challenges s WHERE s.uuid = c.source_challenge_id) = 'code' THEN 'journey-validation'
        WHEN EXISTS (SELECT 1 FROM validation_reference_cases r WHERE r.validation_challenge_id = c.uuid)
          AND NOT EXISTS (SELECT 1 FROM validation_scenario_steps st WHERE st.validation_challenge_id = c.uuid)
          THEN 'endpoint-validation'
        WHEN EXISTS (SELECT 1 FROM validation_scenario_steps st WHERE st.validation_challenge_id = c.uuid)
          AND NOT EXISTS (SELECT 1 FROM validation_reference_cases r WHERE r.validation_challenge_id = c.uuid)
          THEN 'journey-validation'
      END`;

      const { rows: undecidable } = await db.execute(sql`
        SELECT c.uuid, c.title FROM challenges c
        WHERE c.type = 'validation' AND (${decided}) IS NULL`);
      if (undecidable.length > 0) {
        const list = undecidable.map((row) => `${row.uuid} (${row.title})`).join(", ");
        throw new Error(`Validation challenges whose flow cannot be decided, to settle by hand: ${list}`);
      }

      await db.execute(sql`
        UPDATE challenges c SET
          flow_config = CASE WHEN (${decided}) = 'journey-validation'
            THEN COALESCE(c.flow_config, '{}'::jsonb) - 'required_validations'
            ELSE c.flow_config END,
          type = (${decided})
        WHERE c.type = 'validation'`);
    },
  },
  // Remplace la vérification applicative « un challenge de validation par
  // source » : un parent ne porte qu'un challenge de chaque flow. Les doublons
  // éventuels arrêtent la reprise avec leur liste plutôt qu'un échec d'index.
  {
    label: "idx_challenges_source_type (un challenge de chaque flow par parent)",
    run: async () => {
      const { rows: duplicates } = await db.execute(sql`
        SELECT source_challenge_id, type, count(*)::int AS count FROM challenges
        WHERE source_challenge_id IS NOT NULL
        GROUP BY source_challenge_id, type
        HAVING count(*) > 1`);
      if (duplicates.length > 0) {
        const list = duplicates.map((row) => `${row.source_challenge_id} × ${row.type} (${row.count})`).join(", ");
        throw new Error(`Several challenges of the same flow share a parent, to settle by hand: ${list}`);
      }
      await db.execute(sql.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_source_type ON challenges (source_challenge_id, type) WHERE source_challenge_id IS NOT NULL`
      ));
    },
  },

  // --- Qualifications (challenge 020, L3) ---
  // Le rôle ne porte plus que des permissions ; ce qu'on reconnaît à un compte
  // de compétent pour juger devient une qualification, auditée comme un rôle.
  {
    label: "user_qualifications",
    sql: `
      CREATE TABLE IF NOT EXISTS user_qualifications (
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        key varchar(64) NOT NULL,
        granted_by uuid REFERENCES users(uuid) ON DELETE SET NULL,
        granted_at timestamp NOT NULL DEFAULT now(),
        note text,
        PRIMARY KEY (user_id, key)
      )`,
  },
  {
    label: "idx_user_qualifications_key",
    sql: `CREATE INDEX IF NOT EXISTS idx_user_qualifications_key ON user_qualifications (key)`,
  },
  {
    label: "qualification_changes",
    sql: `
      CREATE TABLE IF NOT EXISTS qualification_changes (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        key varchar(64) NOT NULL,
        action varchar(16) NOT NULL,
        changed_by uuid REFERENCES users(uuid) ON DELETE SET NULL,
        note text,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "idx_qualification_changes_user_created",
    sql: `CREATE INDEX IF NOT EXISTS idx_qualification_changes_user_created ON qualification_changes (user_id, created_at)`,
  },
  // Reprise : chaque compte `medical_pro` devient `contributor` et reçoit la
  // qualification `medical_pro`, tracée dans les deux journaux. Une seule
  // transaction : un compte ne peut pas perdre son rôle sans avoir reçu sa
  // qualification. Idempotent : plus aucun `medical_pro` au second passage.
  {
    label: "users.role medical_pro → contributor + qualification medical_pro",
    run: async () => {
      await db.transaction(async (tx) => {
        const { rows } = await tx.execute(sql`SELECT uuid FROM users WHERE role = 'medical_pro' FOR UPDATE`);
        if (rows.length === 0) return;

        const note = "Reprise du rôle medical_pro (challenge 020, L3)";
        await tx.execute(sql`
          INSERT INTO user_qualifications (user_id, key, note)
          SELECT uuid, 'medical_pro', ${note} FROM users WHERE role = 'medical_pro'
          ON CONFLICT DO NOTHING`);
        await tx.execute(sql`
          INSERT INTO qualification_changes (user_id, key, action, note)
          SELECT uuid, 'medical_pro', 'granted', ${note} FROM users WHERE role = 'medical_pro'`);
        await tx.execute(sql`
          INSERT INTO role_changes (user_id, old_role, new_role, note)
          SELECT uuid, 'medical_pro', 'contributor', ${note} FROM users WHERE role = 'medical_pro'`);
        await tx.execute(sql`UPDATE users SET role = 'contributor' WHERE role = 'medical_pro'`);
        console.log(`    ${rows.length} compte(s) medical_pro repris`);
      });
    },
  },
  // Les flows de validation lisent la qualification exigée dans leur
  // configuration : les challenges existants gardent `medical_pro`, et le
  // parcours garde ses rôles éligibles (les medical_pro étant désormais des
  // contributeurs). Idempotent : seules les configurations sans la clé.
  {
    label: "challenges.flow_config (paramètres de qualification des validations)",
    sql: `
      UPDATE challenges
      SET flow_config = jsonb_build_object('reviewer_qualification', 'medical_pro') || COALESCE(flow_config, '{}'::jsonb)
      WHERE type = 'endpoint-validation' AND NOT (COALESCE(flow_config, '{}'::jsonb) ? 'reviewer_qualification')`,
  },
  {
    label: "challenges.flow_config (paramètres de qualification des parcours)",
    sql: `
      UPDATE challenges
      SET flow_config = jsonb_build_object(
          'eligible_roles', '["contributor", "admin"]'::jsonb,
          'expert_comment_qualification', 'medical_pro'
        ) || COALESCE(flow_config, '{}'::jsonb)
      WHERE type = 'journey-validation' AND NOT (COALESCE(flow_config, '{}'::jsonb) ? 'expert_comment_qualification')`,
  },

  // --- Champs de proposition des sandboxes (challenge 020, L3) ---
  //
  // `proposal_fields` reprend repo_url, model_url et dataset_urls ; les
  // colonnes restent, écrites en miroir, jusqu'en L7. La reprise recopie les
  // colonnes dès que le jsonb en diffère : elle rattrape aussi une édition
  // faite par l'ancien code pendant le déploiement, et laisse intactes les
  // clés qu'aucune colonne ne porte. Idempotent : le nouveau code écrit les
  // deux à l'identique.
  {
    label: "sandboxes.proposal_fields",
    sql: `ALTER TABLE sandboxes ADD COLUMN IF NOT EXISTS proposal_fields jsonb NOT NULL DEFAULT '{}'::jsonb`,
  },
  {
    label: "sandboxes.proposal_fields (reprise des colonnes)",
    sql: `
      UPDATE sandboxes
      SET proposal_fields = COALESCE(proposal_fields, '{}'::jsonb) || jsonb_build_object(
          'repo_url', repo_url,
          'model_url', model_url,
          'dataset_urls', COALESCE(dataset_urls, '[]'::jsonb)
        )
      WHERE jsonb_build_object(
          'repo_url', proposal_fields -> 'repo_url',
          'model_url', proposal_fields -> 'model_url',
          'dataset_urls', proposal_fields -> 'dataset_urls'
        ) IS DISTINCT FROM jsonb_build_object(
          'repo_url', repo_url,
          'model_url', model_url,
          'dataset_urls', COALESCE(dataset_urls, '[]'::jsonb)
        )`,
  },

  // --- Type des sandboxes (challenge 020, L6) ---
  //
  // `sandboxes.type` porte la clé d'un flow proposable, plus seulement
  // `code` ou `ml`. Élargir un varchar ne réécrit pas la table ; rejoué sur
  // une colonne déjà en varchar(64), l'ALTER ne change rien.
  {
    label: "sandboxes.type (clé de flow)",
    sql: `ALTER TABLE sandboxes ALTER COLUMN type TYPE varchar(64)`,
  },

  // --- Store des connexions (challenge 020, L5) ---
  //
  // `integration_credentials` reprend les colonnes de connexion d'app_settings,
  // qui ne sont plus lues et partent en L7. Idempotent : une connexion n'est
  // recopiée que si elle est plus récente que celle du store, ce qui rattrape
  // une reconnexion faite par l'ancien code pendant le déploiement sans jamais
  // écraser ce que le nouveau code a écrit. Une déconnexion faite par l'ancien
  // code dans cette fenêtre n'est pas recopiée : elle se refait à la main.
  {
    label: "integration_credentials",
    sql: `
      CREATE TABLE IF NOT EXISTS integration_credentials (
        key varchar(64) PRIMARY KEY,
        secret_enc text,
        secret_iv varchar(64),
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        connected_at timestamp,
        connected_by uuid REFERENCES users(uuid) ON DELETE SET NULL
      )`,
  },
  {
    label: "integration_credentials (reprise d'app_settings)",
    sql: `
      INSERT INTO integration_credentials (key, secret_enc, secret_iv, meta, connected_at, connected_by)
      SELECT v.key, v.secret_enc, v.secret_iv, v.meta, v.connected_at, v.connected_by
      FROM app_settings s
      CROSS JOIN LATERAL (VALUES
        ('github', s.github_token_enc, s.github_token_iv,
          jsonb_build_object('org', s.github_org), s.github_connected_at, s.github_connected_by),
        ('kaggle', s.kaggle_key_enc, s.kaggle_key_iv,
          jsonb_build_object('username', s.kaggle_username), s.kaggle_connected_at, s.kaggle_connected_by),
        ('openai', s.openai_key_enc, s.openai_key_iv,
          '{}'::jsonb, s.openai_connected_at, s.openai_connected_by),
        ('slack', s.slack_token_enc, s.slack_token_iv,
          jsonb_build_object('team_name', s.slack_team_name), s.slack_connected_at, s.slack_connected_by),
        ('scaleway', s.scaleway_secret_key_enc, s.scaleway_secret_key_iv,
          jsonb_build_object('project_id', s.scaleway_project_id, 'zone', s.scaleway_zone,
            'disconnect_requested_at', s.scaleway_disconnect_requested_at),
          s.scaleway_connected_at, s.scaleway_connected_by)
      ) AS v(key, secret_enc, secret_iv, meta, connected_at, connected_by)
      WHERE s.id = 1 AND v.secret_enc IS NOT NULL
      ON CONFLICT (key) DO UPDATE SET
        secret_enc = excluded.secret_enc,
        secret_iv = excluded.secret_iv,
        meta = excluded.meta,
        connected_at = excluded.connected_at,
        connected_by = excluded.connected_by
      WHERE excluded.connected_at > COALESCE(integration_credentials.connected_at, 'epoch'::timestamp)`,
  },

  // --- Crons (challenge 020, L5) ---
  //
  // Le dernier passage et le verrou de chaque job planifié, lus par
  // /api/cron/tick. Les lignes se créent au premier passage de chaque job.
  {
    label: "cron_runs",
    sql: `
      CREATE TABLE IF NOT EXISTS cron_runs (
        job_key varchar(128) PRIMARY KEY,
        last_started_at timestamp,
        last_finished_at timestamp,
        last_status varchar(16),
        last_error text,
        locked_until timestamp
      )`,
  },

  // --- Modules et outbox (challenge 020, L6) ---
  //
  // `module_settings` reprend les drapeaux et réglages de modules
  // d'app_settings, qui ne sont plus lus et partent en L7. La reprise ne
  // touche jamais une ligne existante : un réglage modifié par l'ancien code
  // pendant le déploiement ne sera pas recopié. La sandbox, toujours active
  // jusqu'ici, arrive activée.
  {
    label: "module_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS module_settings (
        key varchar(64) PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamp NOT NULL DEFAULT now(),
        updated_by uuid REFERENCES users(uuid) ON DELETE SET NULL
      )`,
  },
  {
    label: "module_settings (reprise d'app_settings)",
    sql: `
      INSERT INTO module_settings (key, enabled, settings)
      SELECT v.key, v.enabled, v.settings
      FROM app_settings s
      CROSS JOIN LATERAL (VALUES
        ('meetings', s.modules_meetings_enabled, '{}'::jsonb),
        ('onboarding', s.modules_onboarding_enabled, '{}'::jsonb),
        ('digest', s.digest_enabled, jsonb_build_object('frequency_days', s.digest_frequency_days)),
        ('sandbox', true, jsonb_build_object(
          'star_tiers', s.sandbox_star_tiers,
          'promotion_bonus_cp', s.sandbox_promotion_bonus_cp
        ))
      ) AS v(key, enabled, settings)
      WHERE s.id = 1
      ON CONFLICT (key) DO NOTHING`,
  },
  // Les quêtes d'onboarding (challenge 020, L6), une ligne par quête
  // accomplie. La reprise recopie les 5 booléens d'onboarding_progress, datés
  // du jour de la reprise faute d'historique. Rejouée, elle n'ajoute que ce
  // que l'ancien code a validé entre-temps : ON CONFLICT ne touche pas une
  // quête déjà reprise.
  {
    label: "onboarding_quest_progress",
    sql: `
      CREATE TABLE IF NOT EXISTS onboarding_quest_progress (
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        quest_key varchar(64) NOT NULL,
        completed_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, quest_key)
      )`,
  },
  {
    label: "onboarding_quest_progress (reprise d'onboarding_progress)",
    sql: `
      INSERT INTO onboarding_quest_progress (user_id, quest_key, completed_at)
      SELECT p.user_id, v.quest_key, now()
      FROM onboarding_progress p
      CROSS JOIN LATERAL (VALUES
        ('clicked_challenge', p.clicked_challenge),
        ('assigned_task', p.assigned_task),
        ('evaluated_contribution', p.evaluated_contribution),
        ('validated_task', p.validated_task),
        ('joined_meeting', p.joined_meeting)
      ) AS v(quest_key, done)
      WHERE v.done
      ON CONFLICT (user_id, quest_key) DO NOTHING`,
  },
  {
    label: "platform_events",
    sql: `
      CREATE TABLE IF NOT EXISTS platform_events (
        id serial PRIMARY KEY,
        type varchar(128) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "platform_events (type, id)",
    sql: `CREATE INDEX IF NOT EXISTS idx_platform_events_type_id ON platform_events (type, id)`,
  },
  {
    label: "event_deliveries",
    sql: `
      CREATE TABLE IF NOT EXISTS event_deliveries (
        subscriber_key varchar(128) PRIMARY KEY,
        last_event_id integer NOT NULL DEFAULT 0,
        last_error text,
        updated_at timestamp NOT NULL DEFAULT now()
      )`,
  },

  // --- Capacité resources (challenge 020, M1) ---
  {
    label: "resource_instances",
    sql: `
      CREATE TABLE IF NOT EXISTS resource_instances (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        resource_type varchar(64) NOT NULL,
        payload jsonb NOT NULL,
        class varchar(32),
        state varchar(16) NOT NULL DEFAULT 'open',
        verdict varchar(64),
        resolution jsonb,
        created_by uuid REFERENCES users(uuid) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        closed_at timestamp
      )`,
  },
  {
    label: "resource_instances (challenge_id, resource_type, state, class)",
    sql: `CREATE INDEX IF NOT EXISTS idx_resource_instances_draw ON resource_instances (challenge_id, resource_type, state, class)`,
  },
  {
    label: "resource_claims",
    sql: `
      CREATE TABLE IF NOT EXISTS resource_claims (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id uuid NOT NULL REFERENCES resource_instances(uuid) ON DELETE CASCADE,
        challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        result jsonb,
        claimed_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp,
        consumed_at timestamp,
        released_at timestamp
      )`,
  },
  {
    label: "resource_claims.resource_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_resource_claims_resource_id ON resource_claims (resource_id)`,
  },
  {
    label: "resource_claims (challenge_id, user_id)",
    sql: `CREATE INDEX IF NOT EXISTS idx_resource_claims_challenge_user ON resource_claims (challenge_id, user_id)`,
  },
  {
    label: "resource_claims (resource_id, user_id) unique, vivantes",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_claims_live ON resource_claims (resource_id, user_id) WHERE released_at IS NULL`,
  },

  // --- Slugs des URLs publiques (docs/superpowers/plans/2026-09-15-slug-urls.md) ---
  //
  // En toute fin de tableau, volontairement : le SET NOT NULL rend la colonne
  // obligatoire pour l'ancien code encore en ligne pendant le postdeploy. Plus
  // il arrive tard, moins il reste d'instructions capables d'échouer après lui
  // et de laisser l'ancien code incapable de créer un challenge ou un sandbox.
  // Retour arrière si besoin : ALTER TABLE challenges|sandboxes ALTER COLUMN
  // slug DROP NOT NULL.
  //
  // Les tables de redirection d'abord : le backfill lit leurs slugs pour ne
  // jamais attribuer un ancien slug encore en service.
  {
    label: "challenge_slug_redirects",
    sql: `
      CREATE TABLE IF NOT EXISTS challenge_slug_redirects (
        slug varchar(80) PRIMARY KEY,
        challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "challenge_slug_redirects.challenge_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_challenge_slug_redirects_challenge_id ON challenge_slug_redirects (challenge_id)`,
  },
  {
    label: "sandbox_slug_redirects",
    sql: `
      CREATE TABLE IF NOT EXISTS sandbox_slug_redirects (
        slug varchar(80) PRIMARY KEY,
        sandbox_id uuid NOT NULL REFERENCES sandboxes(uuid) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    label: "sandbox_slug_redirects.sandbox_id (index)",
    sql: `CREATE INDEX IF NOT EXISTS idx_sandbox_slug_redirects_sandbox_id ON sandbox_slug_redirects (sandbox_id)`,
  },
  // Nullable à l'ajout : les lignes existantes n'ont pas encore de slug.
  {
    label: "challenges.slug",
    sql: `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS slug varchar(80)`,
  },
  slugStatement("challenges", "challenge_slug_redirects"),
  {
    label: "sandboxes.slug",
    sql: `ALTER TABLE sandboxes ADD COLUMN IF NOT EXISTS slug varchar(80)`,
  },
  slugStatement("sandboxes", "sandbox_slug_redirects"),
];

async function main() {
  console.log("🔧 Apply schema (idempotent)");

  for (const statement of STATEMENTS) {
    if ("run" in statement) await statement.run();
    else await db.execute(sql.raw(statement.sql));
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
