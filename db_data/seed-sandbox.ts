import { eq, and } from "drizzle-orm";
import { db, sandboxes, users, projects } from "../packages/database-service/db/drizzle.js";
import {
  AppSettingsRepository,
  ProjectRepository,
  SandboxRepository,
} from "../packages/database-service/repositories/index.js";
import { SandboxService, SandboxPromotionService, hashIp } from "../packages/services/sandbox/index.js";
import { PlatformRegistry } from "../packages/registry/platform.js";
import { platform } from "../apps/leaderboard-client/src/distribution/mytwin.platform";

// La promotion valide la configuration du challenge avec le flow installé.
PlatformRegistry.install(platform);

/**
 * Sandbox seed — propositions de démonstration, leurs stars et les CP qu'elles paient.
 *
 * Volontairement séparé de `db_data/seed.ts`, qui tourne aussi contre la
 * production (cf. scripts/prod.sh, `db:setup`, `populate-db`) : les stars
 * fabriquées ici paient de vrais paliers dans `sandbox_rewards`, et ces CP
 * remontent dans le classement. Ils n'ont rien à faire dans une base réelle.
 * Même raison que pour `seed-demo.ts` — à lancer à la main, en dev.
 *
 * Comme `seed-demo.ts`, tout passe par les **vrais services** plutôt que par
 * des INSERT à la main : `SandboxService.star()` paie les paliers franchis et
 * `SandboxPromotionService.promote()` ouvre la vraie transaction de promotion.
 * L'état produit est donc exactement celui qu'aurait produit l'usage réel —
 * compteurs, seuils payés et ledger cohérents entre eux.
 *
 * Les deux seules écritures directes, et pourquoi :
 *   - l'évaluation formative, posée par `storeEvaluation()` : la lancer pour de
 *     vrai appellerait GitHub et OpenAI, ce qu'un seed ne doit pas faire ;
 *   - `created_at` / `updated_at`, antidatés après coup : le repository ne les
 *     accepte pas à la création, et sans ça les cinq propositions arriveraient
 *     à la même seconde — le tri « recency » du listing n'aurait rien à montrer.
 *
 * Prérequis : `npm run db:seed`, pour les utilisateurs et les projets.
 *
 * Usage :
 *   npx tsx db_data/seed-sandbox.ts
 *
 * Additif — rejouable sans dupliquer : une proposition est reconnue à son
 * couple (auteur, titre), starer est un upsert, et un palier déjà payé ne peut
 * pas l'être deux fois (index unique partiel sur `sandbox_rewards`).
 */

const appSettingsRepo = new AppSettingsRepository();
const projectRepo = new ProjectRepository();
const sandboxRepo = new SandboxRepository();
const sandboxService = new SandboxService();
// `awardMl` neutralisé : le scoring ML déclenche des appels agent de plusieurs
// dizaines de secondes. Le sandbox promu ci-dessous est de type `code`, pour
// lequel `buildAuthorContributions` ne rend rien — la doublure n'est donc
// jamais appelée. Elle est là pour que ce seed ne puisse pas toucher au réseau
// si quelqu'un promeut un sandbox `ml` en modifiant ce fichier.
const promotionService = new SandboxPromotionService({
  awardMl: async () => {},
});

/** Paliers de démonstration. Inertes par défaut en base — sans eux, starer ne paie rien. */
const STAR_TIERS = [
  { stars: 5, cp: 50 },
  { stars: 15, cp: 100 },
  { stars: 30, cp: 250 },
];
const PROMOTION_BONUS_CP = 200;

/**
 * Hachés d'IP fabriqués, pour que le panneau d'audit admin ait de quoi
 * grouper. Six adresses en rotation : le plafond anti-abus est de 30 stars
 * anonymes par heure et par haché, aucune ne s'en approche.
 */
const DEMO_IP_HASHES = Array.from({ length: 6 }, (_, i) =>
  hashIp(`203.0.113.${10 + i}`, "sandbox-demo-seed")
);

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Les utilisateurs existants, par nom complet — ce seed n'en crée aucun. */
async function loadUsers(): Promise<Map<string, string>> {
  const rows = await db.select({ uuid: users.uuid, full_name: users.full_name }).from(users);
  return new Map(rows.map((row) => [row.full_name, row.uuid]));
}

async function findOrCreateProject(title: string, description: string): Promise<string> {
  const [existing] = await db
    .select({ uuid: projects.uuid })
    .from(projects)
    .where(eq(projects.title, title))
    .limit(1);
  if (existing) return existing.uuid;
  const created = await projectRepo.create({ title, description });
  return created.uuid;
}

/** Reconnue à (auteur, titre) : rejouer le seed ne crée pas de doublon. */
async function findOrCreateSandbox(
  draft: Parameters<SandboxRepository["create"]>[0],
  createdAt: Date
) {
  const [existing] = await db
    .select()
    .from(sandboxes)
    .where(and(eq(sandboxes.user_id, draft.user_id), eq(sandboxes.title, draft.title)))
    .limit(1);
  if (existing) return { uuid: existing.uuid, created: false };

  const created = await sandboxService.create(draft);
  // Antidatage : `create()` ne prend pas de date, et cinq propositions nées à
  // la même seconde ne diraient rien du tri par récence.
  await db
    .update(sandboxes)
    .set({ created_at: createdAt, updated_at: createdAt })
    .where(eq(sandboxes.uuid, created.uuid));
  return { uuid: created.uuid, created: true };
}

/**
 * Pose `accountCount` stars de comptes puis `anonCount` stars anonymes.
 *
 * Passe par `SandboxService.star()` et non par le repository : c'est lui qui
 * compte et paie les paliers franchis. L'auteur est écarté — il ne peut pas
 * starer sa propre proposition (`SelfStarError`).
 */
async function addStars(
  sandboxId: string,
  authorId: string,
  allUserIds: string[],
  accountCount: number,
  anonCount: number,
  anonPrefix: string
): Promise<void> {
  const voters = allUserIds.filter((id) => id !== authorId).slice(0, accountCount);
  for (const [i, userId] of voters.entries()) {
    await sandboxService.star(
      sandboxId,
      { kind: "account", userId },
      DEMO_IP_HASHES[i % DEMO_IP_HASHES.length]
    );
  }

  for (let i = 0; i < anonCount; i++) {
    await sandboxService.star(
      sandboxId,
      { kind: "anonymous", anonId: `${anonPrefix}-${String(i + 1).padStart(3, "0")}` },
      DEMO_IP_HASHES[i % DEMO_IP_HASHES.length]
    );
  }
}

async function main() {
  console.log("🌱 Sandbox seed — propositions, stars et paliers\n");

  const userByName = await loadUsers();
  if (userByName.size < 4) {
    console.error("❌ Pas assez d'utilisateurs en base. Lance d'abord : npm run db:seed");
    process.exit(1);
  }
  const allUserIds = [...userByName.values()];

  /** Chaque proposition a besoin d'un auteur nommé ; à défaut, un utilisateur quelconque. */
  function author(name: string, fallbackIndex: number): string {
    return userByName.get(name) ?? allUserIds[fallbackIndex % allUserIds.length];
  }

  // --- Réglages de l'économie ---
  // Écrits seulement si l'admin n'a rien configuré : ce seed ne doit pas
  // écraser des paliers réglés à la main sur une base de travail.
  const settings = await appSettingsRepo.get();
  if ((settings.sandbox_star_tiers ?? []).length === 0) {
    await appSettingsRepo.update({
      sandbox_star_tiers: STAR_TIERS,
      sandbox_promotion_bonus_cp: PROMOTION_BONUS_CP,
    });
    console.log(
      `✓ Paliers configurés : ${STAR_TIERS.map((t) => `${t.stars}* -> ${t.cp} CP`).join(", ")} · promotion +${PROMOTION_BONUS_CP} CP`
    );
  } else {
    console.log(`✓ Paliers déjà configurés (${settings.sandbox_star_tiers.length}) — laissés tels quels`);
  }

  const projectId = await findOrCreateProject(
    "MyTwin — Jumeau numérique du corps",
    "Projet d'accueil des challenges issus de propositions du Sandbox."
  );

  // --- 1. Code, très staré : les trois paliers franchis ---
  const hotAuthor = author("Camille Daverio", 0);
  const hot = await findOrCreateSandbox(
    {
      user_id: hotAuthor,
      type: "code",
      title: "Open wearable ingestion pipeline for continuous vitals",
      context:
        "Consumer wearables expose heart rate, HRV and SpO2 through a dozen incompatible APIs. Anyone building on top of them re-writes the same normalisation layer, and none of those layers are open.",
      goals: [
        "A single ingestion client for Apple Health, Fitbit, Garmin and Withings",
        "Normalise every stream into one time-series schema with explicit units",
        "Backfill and gap detection, because wearables drop data far more often than their docs admit",
        "A conformance suite any new connector has to pass",
      ],
      why:
        "Continuous vitals are the highest-frequency signal a digital twin can get. Today the cost of collecting them cleanly is what stops most teams before they start modelling anything.",
      repo_url: "https://github.com/mytwin-labs/wearable-ingest",
    },
    daysAgo(46)
  );
  if (hot.created) await addStars(hot.uuid, hotAuthor, allUserIds, 14, 20, "demo-anon-hot");
  console.log(
    hot.created
      ? "✓ Sandbox « wearable ingestion » créé + 34 stars (paliers 5, 15, 30)"
      : "✓ Sandbox « wearable ingestion » déjà présent"
  );

  // --- 2. ML, avec datasets, modèle et une évaluation formative déjà posée ---
  const mlAuthor = author("Patricia Novi", 1);
  const ml = await findOrCreateSandbox(
    {
      user_id: mlAuthor,
      type: "ml",
      title: "Gait asymmetry detection from a single phone camera",
      context:
        "Clinical gait analysis needs a motion lab. A phone on a tripod and thirty seconds of walking should be enough to flag an asymmetry worth a real consultation — not to diagnose, to triage.",
      goals: [
        "Pose estimation robust to a hand-held phone and indoor lighting",
        "Stride-level asymmetry index, comparable across recordings",
        "Calibrate against the lab-grade recordings in the reference dataset",
        "Publish the failure modes as loudly as the accuracy",
      ],
      why:
        "Post-injury rehab is monitored by memory and self-report between appointments. A measurable weekly number is the difference between adjusting a protocol and guessing at it.",
      repo_url: "https://github.com/mytwin-labs/gait-asymmetry",
      model_url: "https://www.kaggle.com/models/mytwin/gait-asymmetry-v1",
      dataset_urls: [
        "https://www.kaggle.com/datasets/mytwin/phone-gait-recordings",
        "https://www.kaggle.com/datasets/mytwin/lab-gait-reference",
      ],
    },
    daysAgo(24)
  );
  if (ml.created) {
    await addStars(ml.uuid, mlAuthor, allUserIds, 12, 6, "demo-anon-gait");
    // Évaluation écrite directement : la lancer pour de vrai appellerait GitHub
    // et OpenAI. La forme est celle que rend `repo-evaluation.ts` —
    // `globalScore` sur 9, que l'UI ramène sur 10 via `toScore10`.
    await sandboxRepo.storeEvaluation(ml.uuid, {
      globalScore: 6.8,
      scores: [
        {
          criterion: "Complexité du code",
          score: 7,
          weight: 0.2,
          comment:
            "Le pipeline de pose est lisible ; l'extraction des foulées concentre trop de branches dans une seule fonction.",
        },
        {
          criterion: "Couverture de tests",
          score: 5,
          weight: 0.2,
          comment:
            "Les helpers géométriques sont testés, le chemin bout-en-bout ne l'est pas — c'est pourtant lui qui casse quand le format d'entrée bouge.",
        },
        {
          criterion: "Séparation des responsabilités",
          score: 8,
          weight: 0.2,
          comment: "Lecture vidéo, inférence et calcul de l'indice sont bien trois modules distincts.",
        },
        {
          criterion: "Documentation technique",
          score: 7,
          weight: 0.2,
          comment:
            "Le README couvre l'installation et un exemple ; les conditions de prise de vue attendues ne sont écrites nulle part.",
        },
        {
          criterion: "Reproductibilité",
          score: 7,
          weight: 0.2,
          comment: "Dépendances épinglées et seed fixée ; la version du modèle de pose n'est pas verrouillée.",
        },
      ],
    });
  }
  console.log(
    ml.created
      ? "✓ Sandbox « gait asymmetry » créé + 18 stars (paliers 5, 15) + évaluation formative"
      : "✓ Sandbox « gait asymmetry » déjà présent"
  );

  // --- 3. Code, tout frais : sous le premier palier ---
  const freshAuthor = author("Samir Touinssi", 2);
  const fresh = await findOrCreateSandbox(
    {
      user_id: freshAuthor,
      type: "code",
      title: "Consent ledger for health data reuse",
      context:
        "A contributor who hands over a recording has no way to see where it ended up, and no way to withdraw it from a model that has already been trained.",
      goals: [
        "Append-only ledger tying each consent grant to the datasets it covers",
        "Withdrawal that propagates to downstream derivations, not just the original row",
        "An audit export a data protection officer can actually read",
      ],
      why:
        "Every other proposal on this board assumes the data is there. This is what makes people willing to hand it over twice.",
      repo_url: "https://github.com/mytwin-labs/consent-ledger",
    },
    daysAgo(5)
  );
  if (fresh.created) await addStars(fresh.uuid, freshAuthor, allUserIds, 3, 0, "demo-anon-consent");
  console.log(
    fresh.created
      ? "✓ Sandbox « consent ledger » créé + 3 stars (aucun palier)"
      : "✓ Sandbox « consent ledger » déjà présent"
  );

  // --- 4. Code, promu : deux paliers payés, puis le bonus de promotion ---
  const promotedAuthor = author("Christyl Hodonou", 3);
  const promoted = await findOrCreateSandbox(
    {
      user_id: promotedAuthor,
      type: "code",
      title: "Reference API harness for clinical model endpoints",
      context:
        "Every model packaged as an API on this platform is tested by hand, against whatever payload its author had open at the time. There is no shared harness, so nothing is comparable.",
      goals: [
        "One declarative case format, shared by every validation challenge",
        "Replay a case set against any endpoint and diff the responses",
        "Latency and error-rate report per endpoint",
        "Run it in CI so a regression is caught before a validator sees it",
      ],
      why:
        "Qualified validation costs a medical professional's time. Spending it on an endpoint that returns a 500 on the third case is the most expensive way to find a bug.",
      repo_url: "https://github.com/mytwin-labs/endpoint-harness",
    },
    daysAgo(72)
  );
  if (promoted.created) {
    await addStars(promoted.uuid, promotedAuthor, allUserIds, 13, 8, "demo-anon-harness");
  }
  // Promotion via le vrai service : garde transactionnelle, challenge, repos,
  // participation de l'auteur et ligne `promotion` du ledger, d'un bloc.
  const promotedRow = await sandboxRepo.findById(promoted.uuid);
  if (promotedRow?.status === "open") {
    const { challenge } = await promotionService.promote({
      sandboxId: promoted.uuid,
      // L'acteur n'est pas persisté : le service ne s'en sert que pour vérifier
      // le rôle. Un admin de façade suffit donc à un seed.
      actor: { userId: promotedAuthor, role: "admin" },
      input: {
        status: "active",
        start_date: daysAgo(60).toISOString().split("T")[0],
        end_date: daysAgo(-30).toISOString().split("T")[0],
        contribution_points_reward: 1200,
        project_id: projectId,
        compute_enabled: false,
        api_packaging_enabled: false,
      },
    });
    await db
      .update(sandboxes)
      .set({ promoted_at: daysAgo(30), updated_at: daysAgo(30) })
      .where(eq(sandboxes.uuid, promoted.uuid));
    console.log(`✓ Sandbox « endpoint harness » + 21 stars, promu → challenge ${challenge.uuid}`);
  } else {
    console.log("✓ Sandbox « endpoint harness » déjà promu");
  }

  // --- 5. Code, archivé : visible du seul auteur, sous l'onglet « Mine » ---
  const archivedAuthor = author("Mahdi Lamriben", 4);
  const archived = await findOrCreateSandbox(
    {
      user_id: archivedAuthor,
      type: "code",
      title: "Browser-side DICOM anonymiser",
      context:
        "Stripping identifiers from a DICOM study before it leaves the hospital network, without installing anything.",
      goals: [
        "Parse and rewrite DICOM tags entirely client-side",
        "Burned-in text detection on the pixel data itself",
      ],
      why: "Retiré au profit d'un outil existant qui fait déjà la même chose, mieux.",
      repo_url: "https://github.com/mytwin-labs/dicom-anon-web",
    },
    daysAgo(120)
  );
  if (archived.created) {
    // Starer avant d'archiver : une proposition qui n'est plus `open` refuse
    // toute nouvelle star. Le palier 5 reste payé après l'archivage — un palier
    // franchi n'est jamais repris.
    await addStars(archived.uuid, archivedAuthor, allUserIds, 6, 0, "demo-anon-dicom");
    await sandboxService.archive(archived.uuid, { userId: archivedAuthor, isAdmin: false });
  }
  console.log(
    archived.created
      ? "✓ Sandbox « DICOM anonymiser » créé + 6 stars (palier 5), archivé"
      : "✓ Sandbox « DICOM anonymiser » déjà présent"
  );

  console.log("\n✅ Sandbox seed terminé avec succès !");
  console.log("   /sandbox — 3 open, 1 promoted, 1 archived (visible de son auteur seul)");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sandbox seed error:", err);
  process.exit(1);
});
