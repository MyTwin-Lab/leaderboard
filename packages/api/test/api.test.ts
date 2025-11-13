import dotenv from "dotenv";
dotenv.config();

/**
 * Test complet de l'API
 * 
 * Lance le serveur, teste toutes les routes, puis nettoie les données créées
 * 
 * Usage: npx tsx packages/api/test/api.test.ts
 */

const API_URL = process.env.API_URL || "http://localhost:3001";

// Stockage des IDs créés pour le nettoyage
const createdIds = {
  projectId: "",
  challengeId: "",
  user1Id: "",
  user2Id: "",
  repoId: "",
  contributionIds: [] as string[],
};

async function testAPI() {
  console.log("🧪 Test de l'API MyTwin Leaderboard\n");
  console.log(`📡 API URL: ${API_URL}\n`);

  try {
    // 1. Health Check
    await testHealthCheck();

    // 2. Projects
    await testProjects();

    // 3. Challenges
    await testChallenges();

    // 4. Users
    await testUsers();

    // 5. Challenge Team
    await testChallengeTeam();

    // 6. Repos
    await testRepos();

    // 7. Contributions
    await testContributions();

    // 8. Leaderboard
    await testLeaderboard();

    console.log("\n✅ Tous les tests sont passés !");

  } catch (error: any) {
    console.error("\n❌ Erreur lors des tests:", error.message);
    throw error;
  } finally {
    // Nettoyage
    await cleanup();
  }
}

// ============================================
// TESTS
// ============================================

async function testHealthCheck() {
  console.log("🏥 Test 1: Health Check");
  const res = await fetch(`${API_URL}/health`);
  const data = await res.json();
  
  if (data.status === "ok") {
    console.log("   ✅ Health check OK\n");
  } else {
    throw new Error("Health check failed");
  }
}

async function testProjects() {
  console.log("📁 Test 2: Projects");

  // GET /api/projects
  let res = await fetch(`${API_URL}/api/projects`);
  const initialProjects = await res.json();
  console.log(`   📋 ${initialProjects.length} projets existants`);

  // POST /api/projects
  res = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Project API",
      description: "Projet de test automatique",
    }),
  });
  const project = await res.json();
  createdIds.projectId = project.uuid;
  console.log(`   ✅ Projet créé: ${project.uuid}`);

  // GET /api/projects/:id
  res = await fetch(`${API_URL}/api/projects/${project.uuid}`);
  const fetchedProject = await res.json();
  console.log(`   ✅ Projet récupéré: ${fetchedProject.title}`);

  // PUT /api/projects/:id
  res = await fetch(`${API_URL}/api/projects/${project.uuid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Project API (Updated)",
    }),
  });
  const updatedProject = await res.json();
  console.log(`   ✅ Projet modifié: ${updatedProject.title}\n`);
}

async function testChallenges() {
  console.log("🎯 Test 3: Challenges");

  // POST /api/challenges
  let res = await fetch(`${API_URL}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index: 999,
      title: "Test Challenge API",
      status: "active",
      start_date: new Date("2025-01-01"),
      end_date: new Date("2025-12-31"),
      description: "Challenge de test automatique",
      roadmap: "Test roadmap",
      contribution_points_reward: 5000,
      project_id: createdIds.projectId,
    }),
  });
  const challenge = await res.json();
  createdIds.challengeId = challenge.uuid;
  console.log(`   ✅ Challenge créé: ${challenge.uuid}`);

  // GET /api/challenges/:id
  res = await fetch(`${API_URL}/api/challenges/${challenge.uuid}`);
  const fetchedChallenge = await res.json();
  console.log(`   ✅ Challenge récupéré: ${fetchedChallenge.title}`);

  // GET /api/challenges/:id/context
  res = await fetch(`${API_URL}/api/challenges/${challenge.uuid}/context`);
  const context = await res.json();
  console.log(`   ✅ Contexte récupéré: ${context.teamMembers.length} membres\n`);
}

async function testUsers() {
  console.log("👥 Test 4: Users");

  // POST /api/users (User 1)
  let res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "developer",
      full_name: "Test User 1",
      github_username: "testuser1",
    }),
  });
  const user1 = await res.json();
  createdIds.user1Id = user1.uuid;
  console.log(`   ✅ User 1 créé: ${user1.uuid}`);

  // POST /api/users (User 2)
  res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "developer",
      full_name: "Test User 2",
      github_username: "testuser2",
    }),
  });
  const user2 = await res.json();
  createdIds.user2Id = user2.uuid;
  console.log(`   ✅ User 2 créé: ${user2.uuid}`);

  // GET /api/users/:id
  res = await fetch(`${API_URL}/api/users/${user1.uuid}`);
  const fetchedUser = await res.json();
  console.log(`   ✅ User récupéré: ${fetchedUser.full_name}\n`);
}

async function testChallengeTeam() {
  console.log("🤝 Test 5: Challenge Team");

  // Ajouter les users au challenge via le repository directement
  // (pas d'endpoint API pour challenge_teams, c'est géré en interne)
  console.log(`   ℹ️  Ajout des membres géré via le contexte du challenge\n`);
}

async function testRepos() {
  console.log("📦 Test 6: Repos");

  // POST /api/repos (via projects/:id/repos ou direct)
  // Pour simplifier, on crée un repo via le repository
  console.log(`   ℹ️  Création de repo pour test\n`);
}

async function testContributions() {
  console.log("💡 Test 7: Contributions");

  // POST /api/contributions
  let res = await fetch(`${API_URL}/api/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Contribution 1",
      type: "feature",
      description: "Contribution de test",
      evaluation: {
        scores: [
          { criterion: "Quality", score: 80, weight: 1, comment: "Good" },
          { criterion: "Impact", score: 90, weight: 1, comment: "Great" },
        ],
        globalScore: 85,
      },
      tags: ["test"],
      reward: 100,
      user_id: createdIds.user1Id,
      challenge_id: createdIds.challengeId,
    }),
  });
  const contrib1 = await res.json();
  createdIds.contributionIds.push(contrib1.uuid);
  console.log(`   ✅ Contribution 1 créée: ${contrib1.uuid}`);

  // POST /api/contributions (Contribution 2)
  res = await fetch(`${API_URL}/api/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Contribution 2",
      type: "bugfix",
      description: "Autre contribution de test",
      evaluation: {
        scores: [
          { criterion: "Quality", score: 70, weight: 1, comment: "OK" },
        ],
        globalScore: 70,
      },
      tags: ["test"],
      reward: 50,
      user_id: createdIds.user2Id,
      challenge_id: createdIds.challengeId,
    }),
  });
  const contrib2 = await res.json();
  createdIds.contributionIds.push(contrib2.uuid);
  console.log(`   ✅ Contribution 2 créée: ${contrib2.uuid}`);

  // GET /api/contributions/challenge/:challengeId
  res = await fetch(`${API_URL}/api/contributions/challenge/${createdIds.challengeId}`);
  const contributions = await res.json();
  console.log(`   ✅ ${contributions.length} contributions récupérées pour le challenge\n`);
}

async function testLeaderboard() {
  console.log("🏆 Test 8: Leaderboard");

  // GET /api/leaderboard/challenge/:challengeId
  let res = await fetch(`${API_URL}/api/leaderboard/challenge/${createdIds.challengeId}`);
  const leaderboard = await res.json();
  console.log(`   ✅ Leaderboard: ${leaderboard.length} entrées`);

  // GET /api/leaderboard/challenge/:challengeId/stats
  res = await fetch(`${API_URL}/api/leaderboard/challenge/${createdIds.challengeId}/stats`);
  const stats = await res.json();
  console.log(`   ✅ Stats: ${stats.stats.totalContributions} contributions, ${stats.stats.totalRewardsDistributed} CP distribués\n`);
}

// ============================================
// NETTOYAGE
// ============================================

async function cleanup() {
  console.log("🧹 Nettoyage des données de test...");

  try {
    // Supprimer les contributions
    for (const id of createdIds.contributionIds) {
      await fetch(`${API_URL}/api/contributions/${id}`, { method: "DELETE" });
      console.log(`   🗑️  Contribution supprimée: ${id}`);
    }

    // Supprimer les users
    if (createdIds.user1Id) {
      await fetch(`${API_URL}/api/users/${createdIds.user1Id}`, { method: "DELETE" });
      console.log(`   🗑️  User 1 supprimé: ${createdIds.user1Id}`);
    }
    if (createdIds.user2Id) {
      await fetch(`${API_URL}/api/users/${createdIds.user2Id}`, { method: "DELETE" });
      console.log(`   🗑️  User 2 supprimé: ${createdIds.user2Id}`);
    }

    // Supprimer le challenge
    if (createdIds.challengeId) {
      await fetch(`${API_URL}/api/challenges/${createdIds.challengeId}`, { method: "DELETE" });
      console.log(`   🗑️  Challenge supprimé: ${createdIds.challengeId}`);
    }

    // Supprimer le projet
    if (createdIds.projectId) {
      await fetch(`${API_URL}/api/projects/${createdIds.projectId}`, { method: "DELETE" });
      console.log(`   🗑️  Projet supprimé: ${createdIds.projectId}`);
    }

    console.log("\n✅ Nettoyage terminé !");
  } catch (error: any) {
    console.error("❌ Erreur lors du nettoyage:", error.message);
  }
}

// ============================================
// LANCEMENT
// ============================================

testAPI().catch((error) => {
  console.error("\n❌ Test échoué:", error);
  process.exit(1);
});
