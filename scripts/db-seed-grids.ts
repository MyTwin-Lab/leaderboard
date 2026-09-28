import { seedGrids } from "../packages/capabilities/grid-seeds.js";
import { gridSeeds } from "../apps/leaderboard-client/src/distribution/mytwin.grids";

/**
 * Insère en base les grilles d'évaluation de la distribution qui n'y sont pas
 * encore (`code`, `model`, `dataset`). Idempotent, pensé pour tourner à chaque
 * déploiement (scalingo postdeploy), après db-apply-schema.
 *
 * Une grille qui porte déjà le slug, publiée, en brouillon ou archivée, n'est
 * jamais modifiée : ce qu'un admin en a fait prime sur le seed.
 *
 * Volontairement fatal : sans ses grilles, chaque évaluation échouerait en
 * production sur « No published grid ». Mieux vaut un déploiement rouge.
 *
 * Usage : npx tsx scripts/db-seed-grids.ts
 */
async function main() {
  console.log("🌱 Seeds de grilles d'évaluation");

  for (const { slug, status } of await seedGrids(gridSeeds)) {
    console.log(`  ${status === "inserted" ? "+ insérée" : "= présente"} : ${slug}`);
  }

  console.log("✅ Grilles en place");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Échec des seeds de grilles :", error);
    process.exit(1);
  });
