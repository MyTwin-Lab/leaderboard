import { eq } from "drizzle-orm";
import { challenges, db } from "../packages/database-service/db/drizzle.js";
import { legacyChallengeColumns } from "../packages/database-service/domain/legacyFlowConfig.js";
import { PlatformRegistry } from "../packages/registry/platform.js";
import { planFlowConfigUpgrade } from "../packages/capabilities/flow-config.js";
import { platform } from "../apps/leaderboard-client/src/distribution/mytwin.platform";

/**
 * Enregistre les montées de version de `challenges.flow_config`. Idempotent,
 * pensé pour tourner à chaque déploiement (scalingo postdeploy), après
 * db-apply-schema.
 *
 * À la lecture, l'application monte déjà en mémoire une configuration écrite
 * dans une version plus ancienne que celle de son flow : ce script ne fait
 * qu'écrire ce résultat, pour que la base rattrape le code. Un challenge dont
 * la montée échoue est journalisé et laissé tel quel ; les autres continuent.
 *
 * Usage : npx tsx scripts/db-upgrade-flow-configs.ts
 */
async function main() {
  console.log("⬆️  Montées de version des configurations de flow");
  PlatformRegistry.install(platform);

  const rows = await db
    .select({
      uuid: challenges.uuid,
      title: challenges.title,
      type: challenges.type,
      flow_config: challenges.flow_config,
      flow_config_version: challenges.flow_config_version,
    })
    .from(challenges);

  let upgraded = 0;
  let skipped = 0;
  for (const row of rows) {
    const plan = planFlowConfigUpgrade(row);
    if (plan.state === "up_to_date") continue;

    if (plan.state === "skipped") {
      skipped++;
      console.warn(`  ! ${row.uuid} (${row.title}) : ${plan.reason}`);
      continue;
    }

    await db
      .update(challenges)
      .set({ ...plan.stored, ...legacyChallengeColumns(plan.stored.flow_config) })
      .where(eq(challenges.uuid, row.uuid));
    upgraded++;
    console.log(`  ↑ ${row.uuid} (${row.title}) : v${plan.from} → v${plan.stored.flow_config_version}`);
  }

  console.log(`✅ ${upgraded} configuration(s) montée(s), ${skipped} ignorée(s), ${rows.length} challenge(s) lus`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Échec des montées de version :", error);
    process.exit(1);
  });
