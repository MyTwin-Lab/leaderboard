import { db } from "../packages/database-service/db/drizzle.js";
import { sql } from "drizzle-orm";
import { PlatformRegistry } from "../packages/registry/platform.js";
import { outOfPoolRuleKeys, poolCompletion } from "../packages/capabilities/pool.js";
import { platform } from "../apps/leaderboard-client/src/distribution/mytwin.platform";

/**
 * Resynchronise les caches dérivés de la reward ledger. Idempotent, pensé
 * pour tourner à chaque déploiement (scalingo postdeploy / prod.sh).
 *
 * 1. contributions.reward — cache de SUM(reward_entries.points). Le trigger
 *    trg_sync_contribution_reward (drizzle/0018) le maintient à chaque
 *    écriture ledger, mais un UPDATE manuel de `reward` ou une période
 *    pré-trigger peuvent laisser un écart : on le détecte et on le corrige.
 *
 * 2. challenges.completion — cache mis à jour applicativement. Tous les
 *    challenges suivent la même formule : completion = min(1, CP pris sur le
 *    pool / pool). Les clés qui ne consomment pas le pool (signaux Slack…)
 *    sont celles que la plateforme installée déclare `consumesPool: false` —
 *    la même règle que les services (`packages/capabilities/pool.ts`).
 *    Toute écriture ledger hors de ces services (fix SQL, ligne corrective)
 *    laisse la completion stale : on recalcule et on corrige.
 *
 * Usage : npx tsx scripts/db-resync-rewards.ts
 */

// challenges.completion est un float4 : on tolère l'imprécision de stockage.
const COMPLETION_EPSILON = 1e-4;

async function resyncContributionRewards(): Promise<number> {
  const { rows } = await db.execute(sql`
    SELECT c.uuid, c.title, c.reward, COALESCE(SUM(re.points), 0)::int AS ledger_total
    FROM contributions c
    JOIN reward_entries re ON re.contribution_id = c.uuid
    GROUP BY c.uuid, c.title, c.reward
    HAVING c.reward <> COALESCE(SUM(re.points), 0)
  `);

  for (const row of rows) {
    console.log(
      `  ✗ "${row.title}" (${row.uuid}) : reward=${row.reward} ≠ ledger=${row.ledger_total} → fix`
    );
    await db.execute(sql`
      UPDATE contributions SET reward = ${Number(row.ledger_total)} WHERE uuid = ${row.uuid}
    `);
  }
  return rows.length;
}

async function resyncChallengeCompletions(): Promise<number> {
  const outOfPool = outOfPoolRuleKeys();
  const outOfPoolFilter = outOfPool.length
    ? sql`AND re.rule_key NOT IN (${sql.join(outOfPool.map((key) => sql`${key}`), sql`, `)})`
    : sql``;

  const { rows: poolRows } = await db.execute(sql`
    SELECT
      ch.uuid, ch.title, ch.type, ch.completion,
      ch.contribution_points_reward AS pool,
      COALESCE((
        SELECT SUM(re.points) FROM reward_entries re
        WHERE re.challenge_id = ch.uuid
          ${outOfPoolFilter}
      ), 0)::int AS distributed
    FROM challenges ch
  `);

  let fixed = 0;

  for (const row of poolRows) {
    const pool = Number(row.pool ?? 0);
    const expected = poolCompletion(pool, Number(row.distributed));
    const stored = Number(row.completion ?? 0);
    if (Math.abs(stored - expected) <= COMPLETION_EPSILON) continue;
    console.log(
      `  ✗ [${row.type}] "${row.title}" (${row.uuid}) : completion=${stored.toFixed(4)} ≠ ${expected.toFixed(4)} (${row.distributed}/${pool} CP) → fix`
    );
    await db.execute(sql`
      UPDATE challenges SET completion = ${expected} WHERE uuid = ${row.uuid}
    `);
    fixed++;
  }

  return fixed;
}

async function main() {
  // Les clés hors pool viennent des déclarations de la plateforme installée.
  PlatformRegistry.install(platform);

  console.log("🔄 Resync reward caches\n");

  console.log("→ contributions.reward vs reward ledger…");
  const contributionsFixed = await resyncContributionRewards();
  console.log(
    contributionsFixed === 0
      ? "  ✓ toutes les contributions avec ledger sont synchronisées"
      : `  ${contributionsFixed} contribution(s) corrigée(s)`
  );

  console.log(`\n→ challenges.completion (hors pool : ${outOfPoolRuleKeys().join(", ") || "aucune clé"})…`);
  const challengesFixed = await resyncChallengeCompletions();
  console.log(
    challengesFixed === 0
      ? "  ✓ toutes les completions sont synchronisées"
      : `  ${challengesFixed} challenge(s) corrigé(s)`
  );

  console.log("\n✅ Resync terminé");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Resync failed:", error);
    process.exit(1);
  });
