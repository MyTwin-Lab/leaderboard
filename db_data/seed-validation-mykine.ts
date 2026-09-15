/**
 * Seed : un challenge de validation en mode scénario, adossé à un challenge
 * `code`, avec l'application MyCoach (MyKine) déjà déployée comme cible.
 *
 * Crée, si elles n'existent pas déjà :
 *   - le projet porteur
 *   - le challenge source `code` et la contribution `project` d'Alix, dont
 *     l'`artifact_url` est le dépôt et l'`live_endpoint_url` le déploiement
 *   - le challenge `validation` adossé à ce challenge source
 *   - la cible exposée (validation_targets)
 *   - les sept étapes du scénario
 *
 * Additif et idempotent : chaque objet est recherché par un identifiant
 * naturel stable avant d'être inséré, donc relancer le script ne duplique
 * rien et n'écrase rien. Même posture que db_data/seed.ts.
 *
 * Lancer : npx tsx db_data/seed-validation-mykine.ts
 *
 * Pré-requis : le schéma doit être à jour (npm run db:apply-schema). Au moment
 * où ce script a été écrit, la base locale était en retard d'une migration sans
 * rapport (colonne `tasks.type` manquante), ce qui fait échouer db:apply-schema
 * avant d'atteindre les tables de scénario — à réparer avant de lancer ceci.
 */
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  projects,
  users,
  challenges,
  contributions,
  validation_targets,
  validation_scenario_steps,
} from "../packages/database-service/db/drizzle.js";
import { ChallengeRepository } from "../packages/database-service/repositories/challenge.repo.js";
import { SLUG_FALLBACK, slugify } from "../packages/database-service/domain/slug.js";

const PROJECT_TITLE = "MyCoach";
const CODE_CHALLENGE_TITLE = "MyCoach — démo patient (parcours mobile)";
const VALIDATION_CHALLENGE_TITLE = "Parcours d'usage — MyCoach";

const REPO_URL = "https://github.com/Akralan/MyKine";
const DEPLOYED_URL = "https://mytwin-sandbox-mykine.osc-fr1.scalingo.io/";

/** Le pool du challenge de validation, et ce que rapporte une walkthrough complétée. */
const CP_POOL = 6000;
const CP_PER_WALKTHROUGH = 200;

/**
 * Le scénario suit le parcours réel de l'application — six écrans plus le
 * profil (voir le README du dépôt). Volontairement pas d'étape « créer un
 * compte » : la démo n'a pas de backend, tout est local au navigateur.
 *
 * L'étape 03 est celle qui décide du reste : MyCoach a besoin de la caméra.
 * Une iframe multi-origine n'y a pas droit tant que la page hôte ne la délègue
 * pas explicitement (`allow="camera"`), donc un validateur qui reste dans
 * l'iframe peut légitimement la marquer « Blocked » — et l'instruction lui dit
 * quoi faire plutôt que de le laisser deviner.
 */
const SCENARIO_STEPS: Array<{ title: string; instructions: string }> = [
  {
    title: "Ouvrir l'accueil et lire la séance du jour",
    instructions:
      "Note si la séance proposée est compréhensible sans explication : sait-on ce qu'on doit faire, combien de temps ça prend, et où on en est dans la semaine ?",
  },
  {
    title: "Ouvrir la liste des exercices",
    instructions:
      "Les exercices prescrits doivent se distinguer de la bibliothèque. Vérifie que toucher une ligne lance bien l'exercice directement, sans écran intermédiaire.",
  },
  {
    title: "Lancer un exercice et autoriser la caméra",
    instructions:
      "Si l'application est intégrée dans le cadre de gauche et que la caméra est refusée sans même demander, marque cette étape « Blocked » et ouvre l'application dans un onglet avec le bouton prévu, puis poursuis le parcours là-bas. Une caméra qui ne démarre pas une fois dans un onglet est un vrai résultat de validation, à marquer « Failed ».",
  },
  {
    title: "Faire une série complète",
    instructions:
      "Le squelette doit suivre le mouvement, le décompte de répétitions avancer, et les mesures s'afficher en surimpression. Signale tout décompte qui saute ou reste bloqué.",
  },
  {
    title: "Lire le bilan de fin de séance",
    instructions:
      "Le bilan agrège toutes les séries de l'exercice. Vérifie que l'amplitude par répétition est lisible et que les unités sont présentes — une mesure sans unité n'est pas exploitable.",
  },
  {
    title: "Ouvrir le replay et parcourir la timeline",
    instructions:
      "Fais glisser la timeline, bascule entre squelette 2D et 3D, et vérifie que les marqueurs de répétitions tombent au bon endroit par rapport à la courbe d'angle.",
  },
  {
    title: "Retrouver la séance dans l'historique",
    instructions:
      "La séance que tu viens de faire doit apparaître, groupée par jour, avec ses totaux, et le replay doit être accessible depuis là. Recharge la page avant de vérifier : les données sont locales au navigateur.",
  },
];

async function findOrCreateProject(): Promise<string> {
  const [existing] = await db
    .select({ uuid: projects.uuid })
    .from(projects)
    .where(eq(projects.title, PROJECT_TITLE))
    .limit(1);
  if (existing) return existing.uuid;

  const uuid = randomUUID();
  await db.insert(projects).values({
    uuid,
    title: PROJECT_TITLE,
    description:
      "Démo patient du usecase MyTwin « MyCoach » : pose estimation on-device, scoring par angles articulaires, replay du mouvement.",
  });
  console.log(`  + projet « ${PROJECT_TITLE} »`);
  return uuid;
}

/** L'auteur de l'application : le propriétaire du dépôt. Réutilisé s'il existe déjà. */
async function findOrCreateAuthor(): Promise<string> {
  const [byGithub] = await db
    .select({ uuid: users.uuid })
    .from(users)
    .where(eq(users.github_username, "akralan"))
    .limit(1);
  if (byGithub) return byGithub.uuid;

  const [byName] = await db
    .select({ uuid: users.uuid })
    .from(users)
    .where(eq(users.full_name, "Alix Chagot"))
    .limit(1);
  if (byName) return byName.uuid;

  const uuid = randomUUID();
  await db.insert(users).values({
    uuid,
    role: "contributor",
    full_name: "Alix Chagot",
    github_username: "akralan",
    bio: "Software Engineer",
  });
  console.log("  + utilisateur « Alix Chagot »");
  return uuid;
}

/** Insert brut (uuid imposé) : le slug est dérivé ici, avec les règles du repository. */
function freeChallengeSlug(title: string): Promise<string> {
  return new ChallengeRepository().availableSlug(slugify(title, SLUG_FALLBACK.challenge));
}

async function findOrCreateCodeChallenge(projectId: string): Promise<string> {
  const [existing] = await db
    .select({ uuid: challenges.uuid })
    .from(challenges)
    .where(eq(challenges.title, CODE_CHALLENGE_TITLE))
    .limit(1);
  if (existing) return existing.uuid;

  const uuid = randomUUID();
  await db.insert(challenges).values({
    uuid,
    title: CODE_CHALLENGE_TITLE,
    slug: await freeChallengeSlug(CODE_CHALLENGE_TITLE),
    status: "completed",
    type: "code",
    description:
      "Construire la démo web du parcours patient MyCoach : six écrans, séance du jour, séance live avec pose estimation, replay et historique.",
    contribution_points_reward: 12000,
    completion: 1,
    project_id: projectId,
    workspace_mode: "provided_repo",
    flow_config: { workspace_mode: "provided_repo" },
  });
  console.log(`  + challenge code « ${CODE_CHALLENGE_TITLE} »`);
  return uuid;
}

/** Le livrable évalué du challenge code, et donc ce qu'un validateur va parcourir. */
async function findOrCreateProjectContribution(
  codeChallengeId: string,
  authorId: string
): Promise<string> {
  const [existing] = await db
    .select({ uuid: contributions.uuid })
    .from(contributions)
    .where(
      and(
        eq(contributions.challenge_id, codeChallengeId),
        eq(contributions.user_id, authorId),
        eq(contributions.type, "project")
      )
    )
    .limit(1);

  if (existing) {
    // L'URL déployée est ce que l'iframe charge : on la remet à jour même si la
    // contribution existait déjà, parce qu'un redéploiement la change.
    await db
      .update(contributions)
      .set({ live_endpoint_url: DEPLOYED_URL, artifact_url: REPO_URL })
      .where(eq(contributions.uuid, existing.uuid));
    return existing.uuid;
  }

  const uuid = randomUUID();
  await db.insert(contributions).values({
    uuid,
    title: "MyCoach — démo patient",
    type: "project",
    description:
      "Parcours patient en six écrans, pose estimation MediaPipe on-device, scoring déterministe par angles articulaires.",
    user_id: authorId,
    challenge_id: codeChallengeId,
    artifact_url: REPO_URL,
    live_endpoint_url: DEPLOYED_URL,
    evaluation_status: "done",
    reward: 0,
  });
  console.log("  + contribution project « MyCoach — démo patient »");
  return uuid;
}

async function findOrCreateValidationChallenge(
  projectId: string,
  codeChallengeId: string
): Promise<string> {
  const [existing] = await db
    .select({ uuid: challenges.uuid })
    .from(challenges)
    .where(eq(challenges.title, VALIDATION_CHALLENGE_TITLE))
    .limit(1);
  if (existing) return existing.uuid;

  const uuid = randomUUID();
  await db.insert(challenges).values({
    uuid,
    title: VALIDATION_CHALLENGE_TITLE,
    slug: await freeChallengeSlug(VALIDATION_CHALLENGE_TITLE),
    status: "active",
    type: "validation",
    description:
      "Parcourir le même scénario d'usage à travers chaque application livrée sur le challenge source, étape par étape, et clore sur un retour global.",
    contribution_points_reward: CP_POOL,
    completion: 0,
    project_id: projectId,
    source_challenge_id: codeChallengeId,
    cp_per_validation: CP_PER_WALKTHROUGH,
    // Volontairement null : en mode scénario il n'y a ni quorum ni résolution,
    // chaque walkthrough complétée paie. Le mode se déduit du type du challenge
    // source, il n'est stocké nulle part.
    required_validations: null,
    flow_config: { cp_per_validation: CP_PER_WALKTHROUGH, required_validations: null },
  });
  console.log(`  + challenge validation « ${VALIDATION_CHALLENGE_TITLE} »`);
  return uuid;
}

async function ensureTarget(validationChallengeId: string, contributionId: string): Promise<void> {
  const [existing] = await db
    .select({ uuid: validation_targets.uuid })
    .from(validation_targets)
    .where(
      and(
        eq(validation_targets.validation_challenge_id, validationChallengeId),
        eq(validation_targets.contribution_id, contributionId)
      )
    )
    .limit(1);
  if (existing) return;

  await db.insert(validation_targets).values({
    uuid: randomUUID(),
    validation_challenge_id: validationChallengeId,
    contribution_id: contributionId,
    position: 0,
  });
  console.log("  + cible exposée");
}

/**
 * Les étapes ne sont insérées que si le scénario est vide. On ne complète pas
 * un scénario partiel : le service le gèle dès la première walkthrough, et y
 * ajouter des étapes après coup rendrait les parcours incomparables.
 */
async function ensureScenarioSteps(validationChallengeId: string): Promise<void> {
  const existing = await db
    .select({ uuid: validation_scenario_steps.uuid })
    .from(validation_scenario_steps)
    .where(eq(validation_scenario_steps.validation_challenge_id, validationChallengeId));

  if (existing.length > 0) {
    console.log(`  = scénario déjà écrit (${existing.length} étapes), laissé tel quel`);
    return;
  }

  await db.insert(validation_scenario_steps).values(
    SCENARIO_STEPS.map((step, index) => ({
      uuid: randomUUID(),
      validation_challenge_id: validationChallengeId,
      position: index,
      title: step.title,
      instructions: step.instructions,
    }))
  );
  console.log(`  + ${SCENARIO_STEPS.length} étapes de scénario`);
}

async function main() {
  console.log("🌱 Seed : challenge de validation en mode scénario (MyCoach)\n");

  const projectId = await findOrCreateProject();
  const authorId = await findOrCreateAuthor();
  const codeChallengeId = await findOrCreateCodeChallenge(projectId);
  const contributionId = await findOrCreateProjectContribution(codeChallengeId, authorId);
  const validationChallengeId = await findOrCreateValidationChallenge(projectId, codeChallengeId);
  await ensureTarget(validationChallengeId, contributionId);
  await ensureScenarioSteps(validationChallengeId);

  console.log("\n✅ Prêt.");
  console.log(`   Challenge de validation : /challenges/${validationChallengeId} (redirige vers son slug)`);
  console.log(`   Configuration          : /challenges/${validationChallengeId}/manage`);
  console.log(`   Application exposée    : ${DEPLOYED_URL}`);
  console.log(
    `\n   Un validateur autre que l'auteur voit « Start » sur cette application ;\n` +
      `   l'auteur la voit « Not eligible ». ${CP_PER_WALKTHROUGH} CP par walkthrough complétée,\n` +
      `   écrêtés au reliquat d'un pool de ${CP_POOL}.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Échec du seed :", error);
    process.exit(1);
  });
