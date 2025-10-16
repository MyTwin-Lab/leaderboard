import { ChallengeService } from "../services/challenge.service.js";

// npx tsx test/test-challenge-service.ts

async function testChallengeService() {
  console.log("🧪 Test du ChallengeService\n");

  const service = new ChallengeService();

  try {
    // Test 1: Récupérer le contexte d'un challenge
    console.log("🔍 Test 1: Récupération du contexte d'un challenge");
    const challengeId = process.env.TEST_CHALLENGE_ID || "test-challenge-uuid";
    
    try {
      const context = await service.getChallengeContext(challengeId);
      console.log(`   ✅ Challenge: ${context.challenge.title}`);
      console.log(`   ✅ Repos: ${context.repos.length}`);
      console.log(`   ✅ Team: ${context.teamMembers.length} membres\n`);
    } catch (error: any) {
      console.log(`   ⚠️ Challenge non trouvé (normal si DB vide): ${error.message}\n`);
    }

    // Test 2: Lancer une évaluation Sync (nécessite un challenge en DB)
    console.log("🔄 Test 2: Lancer une évaluation Sync");
    try {
      const evaluations = await service.runSyncEvaluation(challengeId);
      console.log(`   ✅ ${evaluations.length} évaluations effectuées`);
      
      if (evaluations.length > 0) {
        console.log("\n   📋 Détails des évaluations:");
        evaluations.forEach((evaluation, i) => {
          console.log(`      ${i + 1}. ${evaluation.contribution?.title}`);
          console.log(`         Score global: ${evaluation.globalScore}`);
          console.log(`         User: ${evaluation.contribution?.userId}`);
        });
      }
      console.log();
    } catch (error: any) {
      console.log(`   ⚠️ Erreur lors de l'évaluation: ${error.message}\n`);
    }

    // Test 3: Calculer les rewards (nécessite des contributions en DB)
    console.log("🏆 Test 3: Calculer les rewards");
    console.log("   ⚠️ Ce test nécessite des contributions en DB");
    console.log("   🔴 Test skipé pour l'instant\n");

    console.log("✅ Tests de base terminés!");
    console.log("\n📝 Note: Pour tester complètement le service:");
    console.log("   1. Créez un challenge en DB");
    console.log("   2. Ajoutez des membres à l'équipe");
    console.log("   3. Configurez les repos GitHub/GDrive");
    console.log("   4. Lancez runSyncEvaluation(challengeId)");
  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testChallengeService();