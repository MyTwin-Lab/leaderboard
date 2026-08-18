import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  projects,
  repos,
  challenges,
  users,
} from "../packages/database-service/db/drizzle.js";
import {
  ProjectRepository,
  RepoRepository,
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  UserRepository,
  ContributionRepository,
  RewardEntryRepository,
  ValidationTargetRepository,
  ReferenceCaseRepository,
  CaseClaimRepository,
} from "../packages/database-service/repositories/index.js";
import type { RewardEntryDraft } from "../packages/database-service/repositories/index.js";
import { ReferenceCaseService } from "../packages/services/challenge/reference-case.service.js";
import { ValidationChallengeService } from "../packages/services/challenge/validation-challenge.service.js";

/**
 * Demo seed — ML challenge + qualified validation challenge (challenge-014),
 * with enough state (contributions, rewards, reference cases, claims,
 * verdicts) to see every UI surface render real data.
 *
 * Deliberately separate from db_data/seed.ts, which also runs against
 * production (see scripts/prod.sh / package.json's db:setup, populate-db):
 * this script only ever needs to be run by hand, in a dev DB.
 *
 * Every claim/observation/reveal/verdict below is produced by calling the
 * real services (ReferenceCaseService, ValidationChallengeService) instead of
 * hand-crafting rows — quorum, majority resolution and CP payout come out
 * self-consistent, exactly as they would from real usage. The one exception
 * is ReferenceCaseService.claimCase, which makes a live HTTP call to the
 * target's endpoint: we bypass it and insert the claim directly with a
 * fabricated response, so this script never touches the network.
 *
 * Usage:
 *   npx tsx db_data/seed-demo.ts
 *
 * Additive — safe to run more than once. Each section checks for what it
 * already created before inserting again.
 */

const projectRepo = new ProjectRepository();
const repoRepo = new RepoRepository();
const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const userRepo = new UserRepository();
const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();
const targetRepo = new ValidationTargetRepository();
const caseRepo = new ReferenceCaseRepository();
const caseClaimRepo = new CaseClaimRepository();
const referenceCaseService = new ReferenceCaseService();
const validationChallengeService = new ValidationChallengeService();

function json(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj, null, 2), "utf-8");
}

async function findOrCreateUser(profile: {
  full_name: string;
  role: string;
  bio?: string;
  github_username?: string | null;
}) {
  const [existing] = await db.select({ uuid: users.uuid }).from(users).where(eq(users.full_name, profile.full_name)).limit(1);
  if (existing) return existing.uuid;
  const created = await userRepo.create({
    role: profile.role,
    full_name: profile.full_name,
    bio: profile.bio,
    github_username: profile.github_username ?? undefined,
  });
  return created.uuid;
}

async function findOrCreateProject(title: string, description: string) {
  const [existing] = await db.select({ uuid: projects.uuid }).from(projects).where(eq(projects.title, title)).limit(1);
  if (existing) return existing.uuid;
  const created = await projectRepo.create({ title, description });
  return created.uuid;
}

async function findOrCreateRepo(title: string, type: string, projectId: string) {
  const [existing] = await db.select({ uuid: repos.uuid }).from(repos).where(eq(repos.title, title)).limit(1);
  if (existing) return existing.uuid;
  const created = await repoRepo.create({ title, type, project_id: projectId });
  return created.uuid;
}

async function findOrCreateChallenge(title: string, build: () => Promise<Parameters<ChallengeRepository["create"]>[0]>) {
  const [existing] = await db.select({ uuid: challenges.uuid }).from(challenges).where(eq(challenges.title, title)).limit(1);
  if (existing) return { uuid: existing.uuid, created: false };
  const entity = await build();
  const created = await challengeRepo.create(entity);
  return { uuid: created.uuid, created: true };
}

async function ensureTeamMember(challengeId: string, userId: string) {
  const members = await challengeTeamRepo.findByChallenge(challengeId);
  if (members.some(m => m.user_id === userId)) return;
  await challengeTeamRepo.create({ challenge_id: challengeId, user_id: userId });
}

async function findOrCreateContribution(input: {
  challengeId: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  artifact_url?: string;
  live_endpoint_url?: string;
}) {
  const existing = (await contributionRepo.findByChallenge(input.challengeId)).find(
    c => c.user_id === input.userId && c.type === input.type
  );
  if (existing) return existing.uuid;
  const created = await contributionRepo.create({
    title: input.title,
    type: input.type,
    description: input.description,
    reward: 0,
    user_id: input.userId,
    challenge_id: input.challengeId,
    submitted_at: new Date(),
    evaluation_status: "done",
    artifact_url: input.artifact_url,
    live_endpoint_url: input.live_endpoint_url,
  });
  return created.uuid;
}

async function main() {
  console.log("🌱 Demo seed — ML + qualified validation challenge\n");

  // --- Project ---
  const projectId = await findOrCreateProject(
    "MyTwin — Diagnostic Assisté (Démo)",
    "Modèles ML pour le jumeau numérique du corps (MyTwin) — projet de démonstration ML + validation qualifiée."
  );
  console.log(`✓ Project ready`);

  // --- Medical pros ---
  const drFerrandId = await findOrCreateUser({
    full_name: "Dr. Amélie Ferrand",
    role: "medical_pro",
    bio: "Médecine physique et réadaptation — auteure des cas de référence",
  });
  const drHaddadId = await findOrCreateUser({
    full_name: "Dr. Karim Haddad",
    role: "medical_pro",
    bio: "Radiologue",
  });
  const drLenoirId = await findOrCreateUser({
    full_name: "Dr. Sophie Lenoir",
    role: "medical_pro",
    bio: "Chirurgienne orthopédiste",
  });
  const drRousselId = await findOrCreateUser({
    full_name: "Dr. Julien Roussel",
    role: "medical_pro",
    bio: "Médecin du sport",
  });
  console.log(`✓ 4 medical_pro users ready (1 author + 3 validators)`);

  // --- ML contributors ---
  const christylId = await findOrCreateUser({
    full_name: "Christyl Hodonou",
    role: "contributor",
    bio: "Software & Machine Learning Engineer",
    github_username: "Chrishdn",
  });
  const patriciaId = await findOrCreateUser({
    full_name: "Patricia Novi",
    role: "contributor",
    bio: "Software & Machine Learning Engineer",
    github_username: "n-patricia",
  });
  const mickaelId = await findOrCreateUser({
    full_name: "Mickael Andrieu",
    role: "contributor",
    bio: "Data & AI Engineer",
    github_username: "Mickael-Ndr",
  });
  console.log(`✓ 3 ML contributors ready`);

  // --- ML challenge ---
  const { uuid: mlChallengeId, created: mlCreated } = await findOrCreateChallenge(
    "Détection de lésion ligamentaire du genou (IRM)",
    async () => ({
      title: "Détection de lésion ligamentaire du genou (IRM)",
      status: "active",
      type: "ml",
      description:
        "Entraîner un modèle qui détecte une lésion ligamentaire à partir d'une IRM du genou, packagé derrière une API testable.",
      contribution_points_reward: 2200,
      completion: 0.55,
      project_id: projectId,
      compute_enabled: true,
      start_date: new Date("2026-06-01"),
      reward_rules: {
        version: 1,
        dataset: { cap: 300 },
        model: {
          cap: 500,
          kaggleShare: 0.5,
          metric: { name: "auc", baseline: 0.5, blockThreshold: 0.95 },
          beatBestBonus: 50,
        },
        apiPackaging: { cap: 200 },
        reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
      },
    })
  );
  console.log(mlCreated ? `✓ ML challenge created` : `✓ ML challenge already exists`);

  // --- ML repos + roles ---
  const datasetRepoId = await findOrCreateRepo("Genou IRM — Dataset", "kaggle_dataset", projectId);
  const modelRepoId = await findOrCreateRepo("Détecteur de lésion ligamentaire — Modèle", "kaggle_model", projectId);
  const modelCodeRepoId = await findOrCreateRepo("Détecteur de lésion ligamentaire — Code", "github", projectId);
  const apiRepoId = await findOrCreateRepo("API Packaging — Lésion ligamentaire", "github", projectId);

  const repoRoles: [string, "dataset" | "model" | "model_code" | "api"][] = [
    [datasetRepoId, "dataset"],
    [modelRepoId, "model"],
    [modelCodeRepoId, "model_code"],
    [apiRepoId, "api"],
  ];
  for (const [repoId, role] of repoRoles) {
    const existing = await challengeRepoRepo.findByChallengeAndRepo(mlChallengeId, repoId);
    if (!existing) await challengeRepoRepo.create({ challenge_id: mlChallengeId, repo_id: repoId, role });
  }

  // --- ML team + contributions + workspace URLs ---
  for (const userId of [christylId, patriciaId, mickaelId]) {
    await ensureTeamMember(mlChallengeId, userId);
  }

  const datasetUrls: Record<string, string> = {
    [christylId]: "https://www.kaggle.com/datasets/mytwin/knee-ligament-mri",
    [patriciaId]: "https://www.kaggle.com/datasets/mytwin/knee-mri-scans",
    [mickaelId]: "https://www.kaggle.com/datasets/mytwin/knee-injury-dataset",
  };
  const modelUrls: Record<string, string> = {
    [christylId]: "https://www.kaggle.com/models/mytwin/ligament-detector",
    [patriciaId]: "https://www.kaggle.com/models/mytwin/knee-cnn",
    [mickaelId]: "https://www.kaggle.com/models/mytwin/ligament-baseline",
  };
  const modelCodeUrls: Record<string, string> = {
    [christylId]: "https://github.com/mytwin-labs/ligament-detector",
  };
  const apiUrls: Record<string, string> = {
    [christylId]: "https://github.com/mytwin-labs/ligament-api",
    [mickaelId]: "https://github.com/mickael-ndr/ligament-api-baseline",
  };

  await challengeRepoRepo.updateWorkspace(mlChallengeId, datasetRepoId, { workspace_meta: { userUrls: datasetUrls } });
  await challengeRepoRepo.updateWorkspace(mlChallengeId, modelRepoId, { workspace_meta: { userUrls: modelUrls } });
  await challengeRepoRepo.updateWorkspace(mlChallengeId, modelCodeRepoId, { workspace_meta: { userUrls: modelCodeUrls } });
  await challengeRepoRepo.updateWorkspace(mlChallengeId, apiRepoId, { workspace_meta: { userUrls: apiUrls } });

  const christylApiEndpoint = "https://mytwin-ligament-api.onrender.com/predict";
  const mickaelApiEndpoint = "https://mytwin-ligament-api-baseline.onrender.com/predict";

  const christylDatasetContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: christylId, type: "dataset",
    title: "Dataset Submission", description: `dataset: ${datasetUrls[christylId]}`,
    artifact_url: datasetUrls[christylId],
  });
  const christylModelContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: christylId, type: "model",
    title: "Model Submission",
    description: `model: ${modelUrls[christylId]}\nmodel_code: ${modelCodeUrls[christylId]}`,
    artifact_url: modelUrls[christylId],
  });
  const christylApiContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: christylId, type: "api_packaging",
    title: "API Packaging Submission", description: `api: ${apiUrls[christylId]}`,
    artifact_url: apiUrls[christylId], live_endpoint_url: christylApiEndpoint,
  });

  const patriciaDatasetContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: patriciaId, type: "dataset",
    title: "Dataset Submission", description: `dataset: ${datasetUrls[patriciaId]}`,
    artifact_url: datasetUrls[patriciaId],
  });
  const patriciaModelContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: patriciaId, type: "model",
    title: "Model Submission", description: `model: ${modelUrls[patriciaId]}`,
    artifact_url: modelUrls[patriciaId],
  });

  const mickaelDatasetContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: mickaelId, type: "dataset",
    title: "Dataset Submission", description: `dataset: ${datasetUrls[mickaelId]}`,
    artifact_url: datasetUrls[mickaelId],
  });
  const mickaelModelContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: mickaelId, type: "model",
    title: "Model Submission", description: `model: ${modelUrls[mickaelId]}`,
    artifact_url: modelUrls[mickaelId],
  });
  const mickaelApiContrib = await findOrCreateContribution({
    challengeId: mlChallengeId, userId: mickaelId, type: "api_packaging",
    title: "API Packaging Submission", description: `api: ${apiUrls[mickaelId]}`,
    artifact_url: apiUrls[mickaelId], live_endpoint_url: mickaelApiEndpoint,
  });
  console.log(`✓ ML contributions ready (Christyl: full pipeline, Patricia: dataset+model, Mickael: full pipeline)`);

  // --- ML reward entries (leaderboard pool) ---
  const existingMlRewards = await rewardRepo.findByChallenge(mlChallengeId);
  if (existingMlRewards.length === 0) {
    const entries: RewardEntryDraft[] = [
      { challenge_id: mlChallengeId, user_id: christylId, contribution_id: christylDatasetContrib, rule_key: "dataset", points: 260 },
      { challenge_id: mlChallengeId, user_id: christylId, contribution_id: christylModelContrib, rule_key: "model_metric", points: 300, meta: { metricValue: 0.88 } },
      { challenge_id: mlChallengeId, user_id: christylId, contribution_id: christylModelContrib, rule_key: "model_code", points: 150 },
      { challenge_id: mlChallengeId, user_id: christylId, contribution_id: christylModelContrib, rule_key: "beat_best", points: 50 },
      { challenge_id: mlChallengeId, user_id: christylId, contribution_id: christylApiContrib, rule_key: "api_packaging", points: 180 },

      { challenge_id: mlChallengeId, user_id: patriciaId, contribution_id: patriciaDatasetContrib, rule_key: "dataset", points: 220 },
      { challenge_id: mlChallengeId, user_id: patriciaId, contribution_id: patriciaModelContrib, rule_key: "model_metric", points: 240, meta: { metricValue: 0.79 } },

      { challenge_id: mlChallengeId, user_id: mickaelId, contribution_id: mickaelDatasetContrib, rule_key: "dataset", points: 200 },
      { challenge_id: mlChallengeId, user_id: mickaelId, contribution_id: mickaelModelContrib, rule_key: "model_metric", points: 210, meta: { metricValue: 0.74 } },
      { challenge_id: mlChallengeId, user_id: mickaelId, contribution_id: mickaelApiContrib, rule_key: "api_packaging", points: 140 },
    ];
    await rewardRepo.createManyAndSyncRewards(entries);
    console.log(`✓ ML reward entries created (1950 CP distributed of 2200 pool)`);
  } else {
    console.log(`✓ ML reward entries already exist (${existingMlRewards.length} rows)`);
  }

  // --- Validation challenge ---
  const { uuid: validationChallengeId, created: valCreated } = await findOrCreateChallenge(
    "Validation clinique qualifiée — API Lésion Ligamentaire",
    async () => ({
      title: "Validation clinique qualifiée — API Lésion Ligamentaire",
      status: "active",
      type: "validation",
      description:
        "Validation par des professionnels de santé qualifiés (medical_pro) des API de détection de lésion ligamentaire exposées par le challenge ML associé — voir challenges/challenge-014-qualified_validation/SPEC.md.",
      contribution_points_reward: 300,
      completion: 1.0,
      project_id: projectId,
      source_challenge_id: mlChallengeId,
      cp_per_validation: 40,
      required_validations: 3,
    })
  );
  console.log(valCreated ? `✓ Validation challenge created` : `✓ Validation challenge already exists`);

  // --- Validation targets ---
  async function ensureTarget(contributionId: string) {
    const existing = await targetRepo.findByChallengeAndContribution(validationChallengeId, contributionId);
    if (existing) return existing;
    return targetRepo.create({ validation_challenge_id: validationChallengeId, contribution_id: contributionId, position: 0 });
  }
  const targetWorks = await ensureTarget(christylApiContrib);
  const targetBroken = await ensureTarget(mickaelApiContrib);
  console.log(`✓ Validation targets ready (Christyl's API, Mickael's API)`);

  // --- Reference cases (exactly required_validations = 3), authored by Dr. Ferrand ---
  const CASES = [
    {
      inputFilename: "case-1-irm-genou.json",
      input: { patientAgeRange: "25-34", sex: "F", kneeMriFindings: "Rupture partielle du LCA, grade II, épanchement modéré", modality: "IRM 1.5T, séquence T2 FS" },
      expectedFilename: "case-1-attendu.json",
      expected: { diagnosis: "lesion_ligamentaire_detectee", ligament: "LCA", grade: "II", confidence_attendue: "modérée à élevée" },
      worksResponse: { diagnosis: "lesion_ligamentaire_detectee", ligament: "LCA", grade: "II", confidence: 0.86, modelVersion: "v1.3" },
      brokenResponse: { diagnosis: "aucune_lesion_ligamentaire", ligament: null, confidence: 0.55, modelVersion: "v0.9-beta" },
      brokenStatus: 200,
      validatorId: drHaddadId,
      observationWorks: "Réponse cohérente avec une IRM montrant une atteinte du LCA ; grade et confiance plausibles.",
      observationBroken: "Le modèle ne détecte aucune lésion alors que l'IRM décrit une rupture partielle du LCA avec épanchement — réponse suspecte.",
      verdictWorks: "La sortie du modèle correspond au diagnostic attendu (LCA grade II) avec un niveau de confiance cohérent.",
      verdictBroken: "Faux négatif : le modèle ne détecte pas la rupture du LCA pourtant décrite dans l'IRM, alors que la sortie attendue confirmait clairement la lésion.",
    },
    {
      inputFilename: "case-2-irm-genou.json",
      input: { patientAgeRange: "45-54", sex: "M", kneeMriFindings: "Ménisque interne intact, ligaments intacts, arthrose fémoro-tibiale débutante", modality: "IRM 1.5T, séquence T1/T2" },
      expectedFilename: "case-2-attendu.json",
      expected: { diagnosis: "aucune_lesion_ligamentaire", ligament: null, grade: null, confidence_attendue: "faible probabilité de lésion" },
      worksResponse: { diagnosis: "aucune_lesion_ligamentaire", ligament: null, confidence: 0.91, modelVersion: "v1.3" },
      brokenResponse: { diagnosis: "lesion_ligamentaire_detectee", ligament: "LCA", grade: "I", confidence: 0.52, modelVersion: "v0.9-beta" },
      brokenStatus: 200,
      validatorId: drLenoirId,
      observationWorks: "Le modèle ne signale aucune lésion, ce qui correspond à une IRM sans atteinte ligamentaire.",
      observationBroken: "Le modèle signale une lésion du LCA sur une IRM pourtant décrite comme sans atteinte ligamentaire — faux positif.",
      verdictWorks: "Sortie correcte : absence de lésion correctement identifiée, confiance élevée cohérente avec une IRM normale.",
      verdictBroken: "Faux positif : lésion signalée à tort (LCA grade I) alors que l'IRM ne décrit aucune atteinte ligamentaire.",
    },
    {
      inputFilename: "case-3-irm-genou.json",
      input: { patientAgeRange: "18-24", sex: "M", kneeMriFindings: "Rupture complète du LCP, désinsertion, hémarthrose", modality: "IRM 3T, séquence PD FS" },
      expectedFilename: "case-3-attendu.json",
      expected: { diagnosis: "lesion_ligamentaire_detectee", ligament: "LCP", grade: "III", confidence_attendue: "élevée" },
      worksResponse: { diagnosis: "lesion_ligamentaire_detectee", ligament: "LCP", grade: "III", confidence: 0.79, modelVersion: "v1.3" },
      brokenResponse: { error: "Internal Server Error", detail: "Unhandled exception during inference" },
      brokenStatus: 500,
      validatorId: drRousselId,
      observationWorks: "Rupture complète du LCP correctement détectée, grade sévère cohérent avec l'hémarthrose décrite.",
      observationBroken: "L'API renvoie une erreur 500 au lieu d'une réponse exploitable — le modèle plante sur ce cas.",
      verdictWorks: "Détection correcte d'une rupture complète du LCP de grade III, conforme à la sortie attendue.",
      verdictBroken: "L'endpoint plante (erreur 500) au lieu de répondre — impossible de juger la qualité du diagnostic, verdict défectueux.",
    },
  ];

  const existingCaseCount = await caseRepo.countByChallenge(validationChallengeId);
  let referenceCases: { uuid: string }[];
  if (existingCaseCount === 0) {
    referenceCases = [];
    for (const c of CASES) {
      const created = await referenceCaseService.authorCase({
        validationChallengeId,
        authorUserId: drFerrandId,
        input: { buffer: json(c.input), filename: c.inputFilename, contentType: "application/json" },
        expectedOutput: { buffer: json(c.expected), filename: c.expectedFilename, contentType: "application/json" },
      });
      referenceCases.push({ uuid: created.uuid });
    }
    console.log(`✓ 3 reference cases authored by Dr. Ferrand`);
  } else {
    const found = await caseRepo.findByChallenge(validationChallengeId);
    referenceCases = found.map(c => ({ uuid: c.uuid }));
    console.log(`✓ Reference cases already exist (${existingCaseCount})`);
  }

  // --- Claims + observations + reveals + verdicts, for both targets ---
  async function runClaimAndVote(target: { uuid: string; contribution_id: string }, caseIndex: number, outcome: "works" | "broken") {
    const c = CASES[caseIndex];
    const referenceCaseId = referenceCases[caseIndex].uuid;

    const alreadyClaimed = await caseClaimRepo.findByValidatorAndTarget(c.validatorId, target.contribution_id);
    if (alreadyClaimed.some(claim => claim.reference_case_id === referenceCaseId)) {
      return; // already seeded on a previous run
    }

    const response = outcome === "works" ? c.worksResponse : c.brokenResponse;
    const status = outcome === "works" ? 200 : c.brokenStatus;

    const claim = await caseClaimRepo.create({
      reference_case_id: referenceCaseId,
      contribution_id: target.contribution_id,
      validator_user_id: c.validatorId,
      response_bytes: json(response),
      response_content_type: "application/json",
      response_status: status,
    });
    if (!claim) return; // lost a race — shouldn't happen in a single-run seed, but stay safe

    await referenceCaseService.recordObservation({
      claimId: claim.uuid,
      validatorUserId: c.validatorId,
      observation: outcome === "works" ? c.observationWorks : c.observationBroken,
    });
    await referenceCaseService.revealExpectedOutput({ claimId: claim.uuid, validatorUserId: c.validatorId });

    await validationChallengeService.castVerdict({
      validationChallengeId,
      contributionId: target.contribution_id,
      validatorUserId: c.validatorId,
      verdict: outcome,
      description: outcome === "works" ? c.verdictWorks : c.verdictBroken,
      referenceCaseClaimId: claim.uuid,
    });
  }

  for (let i = 0; i < CASES.length; i++) {
    await runClaimAndVote(targetWorks, i, "works");
    await runClaimAndVote(targetBroken, i, "broken");
  }
  console.log(`✓ Validation claims/observations/reveals/verdicts recorded — both targets should now be resolved`);

  console.log("\n✅ Demo seed terminé avec succès!");
  console.log(`   ML challenge: ${mlChallengeId}`);
  console.log(`   Validation challenge: ${validationChallengeId}`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Demo seed error:", err);
  process.exit(1);
});
