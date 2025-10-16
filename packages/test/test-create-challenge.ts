import dotenv from "dotenv";
dotenv.config();

import { 
  ChallengeRepository, 
  UserRepository, 
  ChallengeTeamRepository,
  ProjectRepository,
  RepoRepository,
  ChallengeRepoRepository
} from "../database-service/repositories/index.js";

// npx tsx test/test-create-challenge.ts

async function testCreateChallenge() {
  console.log("🧪 Test de création d'un Challenge en DB\n");

  const projectRepo = new ProjectRepository();
  const challengeRepo = new ChallengeRepository();
  const userRepo = new UserRepository();
  const challengeTeamRepo = new ChallengeTeamRepository();
  const repoRepo = new RepoRepository();
  const challengeRepoRepo = new ChallengeRepoRepository();

  try {
    // ========================================
    // 1. CRÉER UN PROJET
    // ========================================
    console.log("📁 Étape 1: Création d'un projet");
    const project = await projectRepo.create({
      title: "MyTwin Lab",
      description: "Laboratoire d'innovation MyTwin",
    });
    console.log(`   ✅ Projet créé: ${project.title} (${project.uuid})\n`);

    // ========================================
    // 2. CRÉER UN CHALLENGE
    // ========================================
    console.log("🎯 Étape 2: Création d'un challenge");
    const challenge = await challengeRepo.create({
      index: 1,
      title: "Application NutriPlanner",
      status: "active",
      start_date: new Date("2025-01-01"),
      end_date: new Date("2025-12-31"),
      description: "Développement d'une application de suivi calorique",
      roadmap: "Phase 1: Backend, Phase 2: Frontend, Phase 3: Déploiement",
      contribution_points_reward: 10000, // Pool de 10000 CP à distribuer
      project_id: project.uuid,
    });
    console.log(`   ✅ Challenge créé: ${challenge.title} (${challenge.uuid})`);
    console.log(`   📅 Dates: ${challenge.start_date} → ${challenge.end_date}`);
    console.log(`   💰 Pool de rewards: ${challenge.contribution_points_reward} CP\n`);

    // ========================================
    // 3. CRÉER DES USERS
    // ========================================
    console.log("👥 Étape 3: Création des utilisateurs");
    
    const user1 = await userRepo.create({
      role: "developer",
      full_name: "Alix Chagot",
      github_username: "Akralan",
    });
    console.log(`   ✅ User 1: ${user1.full_name} (@${user1.github_username}) - ${user1.uuid}`);

    const user2 = await userRepo.create({
      role: "developer",
      full_name: "Antoine Tessier",
      github_username: "KaoDje",
    });
    console.log(`   ✅ User 2: ${user2.full_name} (@${user2.github_username}) - ${user2.uuid}\n`);

    // ========================================
    // 4. AJOUTER LES USERS À L'ÉQUIPE DU CHALLENGE
    // ========================================
    console.log("🤝 Étape 4: Ajout des membres à l'équipe du challenge");
    
    await challengeTeamRepo.create({
      challenge_id: challenge.uuid,
      user_id: user1.uuid,
    });
    console.log(`   ✅ ${user1.full_name} ajouté à l'équipe`);

    await challengeTeamRepo.create({
      challenge_id: challenge.uuid,
      user_id: user2.uuid,
    });
    console.log(`   ✅ ${user2.full_name} ajouté à l'équipe\n`);

    // ========================================
    // 5. CRÉER UN REPO ET L'ASSOCIER AU CHALLENGE
    // ========================================
    console.log("📦 Étape 5: Création d'un repository");
    
    const repo = await repoRepo.create({
      title: "NutriPlanner",
      type: "github",
      external_repo_id: "Akralan/NutriPlanner",
      project_id: project.uuid,
    });
    console.log(`   ✅ Repo créé: ${repo.title} (${repo.uuid})`);

    await challengeRepoRepo.create({
      challenge_id: challenge.uuid,
      repo_id: repo.uuid,
    });
    console.log(`   ✅ Repo associé au challenge\n`);

    // ========================================
    // 6. AFFICHER LE RÉSUMÉ
    // ========================================
    console.log("=" .repeat(60));
    console.log("📊 RÉSUMÉ DE LA CRÉATION");
    console.log("=" .repeat(60));
    console.log(`\n🎯 Challenge: ${challenge.title}`);
    console.log(`   UUID: ${challenge.uuid}`);
    console.log(`   Status: ${challenge.status}`);
    console.log(`   Pool de rewards: ${challenge.contribution_points_reward} CP`);
    
    console.log(`\n👥 Équipe (${2} membres):`);
    console.log(`   1. ${user1.full_name} (@${user1.github_username})`);
    console.log(`      UUID: ${user1.uuid}`);
    console.log(`   2. ${user2.full_name} (@${user2.github_username})`);
    console.log(`      UUID: ${user2.uuid}`);
    
    console.log(`\n📦 Repositories (${1}):`);
    console.log(`   - ${repo.title} (${repo.type})`);
    console.log(`     UUID: ${repo.uuid}`);

    console.log("\n" + "=" .repeat(60));
    console.log("✅ CRÉATION TERMINÉE AVEC SUCCÈS!");
    console.log("=" .repeat(60));
    
    console.log("\n💡 Prochaines étapes:");
    console.log(`   1. Tester l'évaluation: npx tsx test/test-challenge-service.ts`);
    console.log(`   2. Utiliser ce challenge UUID: ${challenge.uuid}`);
    console.log(`   3. Ajouter dans .env: TEST_CHALLENGE_ID=${challenge.uuid}`);

  } catch (error: any) {
    console.error("\n❌ Erreur lors de la création:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testCreateChallenge();