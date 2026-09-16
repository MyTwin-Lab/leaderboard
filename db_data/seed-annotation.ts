import { eq } from "drizzle-orm";
import { db, challenges, projects, users } from "../packages/database-service/db/drizzle.js";
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  ProjectRepository,
} from "../packages/database-service/repositories/index.js";
import { PlatformRegistry } from "../packages/registry/platform.js";
import { prepareFlowConfig } from "../packages/capabilities/flow-config.js";
import { resources } from "../packages/capabilities/resources.js";
import { actionContext } from "../packages/capabilities/testing/action-context.js";
import { DATA_ANNOTATION_FLOW_KEY } from "../content/flows/data-annotation/descriptor.js";
import { GOLD, ITEM } from "../content/flows/data-annotation/config.js";
import { draw, label } from "../content/flows/data-annotation/actions/work.js";

// Les clés du ledger et la configuration se vérifient contre le flow installé.
// Import dynamique : sous tsx et Node 24, l'import statique de ce fichier de
// l'app ne voit pas ses exports nommés.
const { platform } = await import("../apps/leaderboard-client/src/distribution/mytwin.platform");
PlatformRegistry.install(platform);

/**
 * Annotation seed — une campagne de démonstration (challenge 020, M3).
 *
 * Séparé de `db_data/seed.ts` pour la même raison que `seed-sandbox.ts` : les
 * labels fabriqués ici paient de vrais CP, qui n'ont rien à faire dans une
 * base réelle. À lancer à la main, en dev.
 *
 * Les labels passent par les **vraies actions** du flow (`draw` puis `label`,
 * appelées avec le contexte des tests de handlers) : tirage borné par `k`,
 * résolution par accord et paie sont exactement ceux de l'usage réel.
 *
 * Les images sont des photos de démonstration (picsum.photos), avec une
 * question neutre : aucune donnée médicale.
 *
 * Prérequis : `npm run db:apply-schema` (tables `resource_*`) et
 * `npm run db:seed` (utilisateurs).
 *
 * Usage :
 *   npx tsx db_data/seed-annotation.ts
 *
 * Additif : la campagne est reconnue à son titre ; rejouée, elle n'importe
 * rien de plus et laisse les annotateurs tirer ce qui reste.
 */

const TITLE = "Demo annotation campaign";
const ITEMS = 30;
const GOLDS = 6;
const OPTIONS = [
  { key: "outdoor", label: "Outdoor" },
  { key: "indoor", label: "Indoor" },
  { key: "unclear", label: "Can't tell" },
];

const imageUrl = (seed: string) => `https://picsum.photos/seed/${seed}/640/480`;

async function main() {
  console.log("🌱 Annotation seed — campagne de démonstration\n");

  const annotators = await db.select({ uuid: users.uuid, full_name: users.full_name, role: users.role }).from(users);
  if (annotators.length < 3) {
    console.error("❌ Pas assez d'utilisateurs en base. Lance d'abord : npm run db:seed");
    process.exit(1);
  }

  const challengeRepo = new ChallengeRepository();
  const [existing] = await db.select({ uuid: challenges.uuid }).from(challenges).where(eq(challenges.title, TITLE)).limit(1);

  let challenge = existing ? await challengeRepo.findById(existing.uuid) : null;
  if (!challenge) {
    const [project] = await db.select({ uuid: projects.uuid }).from(projects).limit(1);
    const projectId = project?.uuid ?? (await new ProjectRepository().create({ title: "Demo", description: "Demo project" })).uuid;

    challenge = await challengeRepo.create({
      title: TITLE,
      status: "active",
      type: DATA_ANNOTATION_FLOW_KEY,
      description: "Tell whether each photo was taken outdoors or indoors.",
      contribution_points_reward: 2000,
      completion: 0,
      project_id: projectId,
      reward_rules: { per_unit_cp: 5, gold_rate: 0.2, audit_rate: 0.5 },
      ...prepareFlowConfig(DATA_ANNOTATION_FLOW_KEY, {
        k: 3,
        ttl_hours: 24,
        label_schema: { kind: "single_choice", options: OPTIONS },
        sensitive_clearance: { min_seen: 2, min_accuracy: 0.6 },
      }),
    } as never);
    console.log(`✓ Challenge créé : ${challenge.title} (/challenges/${challenge.slug})`);

    const res = resources();
    const items = Array.from({ length: ITEMS }, (_, i) => ({
      payload: { image_url: imageUrl(`annotation-item-${i}`) },
      class: i % 10 === 9 ? "sensitive" : "standard",
    }));
    const golds = Array.from({ length: GOLDS }, (_, i) => ({
      payload: { image_url: imageUrl(`annotation-gold-${i}`), expected: i % 2 === 0 ? "outdoor" : "indoor" },
    }));
    console.log(`✓ ${await res.createMany(challenge.uuid, ITEM, items)} items importés`);
    console.log(`✓ ${await res.createMany(challenge.uuid, GOLD, golds)} golds importés`);
  } else {
    console.log(`✓ Challenge déjà là : ${challenge.title} — rien d'importé`);
  }

  // Trois annotateurs rejoignent la campagne et labellisent quelques images.
  const teamRepo = new ChallengeTeamRepository();
  const labelers = annotators.slice(0, 3);
  for (const [index, annotator] of labelers.entries()) {
    if (!(await teamRepo.findByChallengeAndUser(challenge.uuid, annotator.uuid))) {
      await teamRepo.create({ challenge_id: challenge.uuid, user_id: annotator.uuid });
    }

    let labeled = 0;
    let cp = 0;
    for (let n = 0; n < 12; n++) {
      const ctx = { challenge, user: { id: annotator.uuid, role: annotator.role ?? "contributor" }, access: { member: true } };
      const drawn = (await draw(actionContext({ ...ctx, method: "POST" }))) as { claim: { claim_id: string } | null };
      if (!drawn.claim) break;

      // Le premier annotateur répond presque toujours « outdoor » : de quoi
      // voir des désaccords, des contestés et une précision qui baisse.
      const value = index === 0 ? "outdoor" : OPTIONS[(n + index) % 2].key;
      const result = await label(actionContext({ ...ctx, body: { value }, params: { claimId: drawn.claim.claim_id } }));
      if (result instanceof Response) continue;
      labeled++;
      cp += (result as { cp_awarded: number }).cp_awarded;
    }
    console.log(`✓ ${annotator.full_name} : ${labeled} labels, ${cp} CP`);
  }

  console.log("\n✅ Campagne prête. Le job annotation.audit reprendra les labels contraires au consensus.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Annotation seed :", err);
  process.exit(1);
});
