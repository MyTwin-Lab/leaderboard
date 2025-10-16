import { GitHubExternalConnector } from "../connectors/implementation/Github.connector.js";

// npx tsx test/test-github.ts

async function testGitHubExternalConnector() {
  console.log("🧪 Test du GitHubExternalConnector (ExternalConnector)\n");

  const connector = new GitHubExternalConnector({
    token: process.env.GITHUB_TOKEN || "",
    owner: process.env.GITHUB_OWNER || "Akralan",
    repo: process.env.GITHUB_REPO || "NutriPlanner",
  });

  try {
    // Test 1: Connexion
    console.log("📡 Test 1: Connexion au repository GitHub");
    await connector.connect();
    console.log("   ✅ Connexion établie\n");

    // Test 2: Test de connexion
    console.log("🔍 Test 2: Vérification de la connexion");
    const isConnected = await connector.testConnection();
    console.log(`   ${isConnected ? '✅' : '❌'} Connexion ${isConnected ? 'valide' : 'invalide'}\n`);

    if (!isConnected) {
      throw new Error("La connexion a échoué");
    }

    // Test 3: Récupérer les commits récents (derniers 7 jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 21);
    
    console.log(`📋 Test 3: Récupération des commits des 7 derniers jours`);
    const items = await connector.fetchItems({
      //since: sevenDaysAgo.toISOString(),
      maxCommits: 10,
    });
    
    console.log(`   ✅ ${items.length} commit(s) récupéré(s):`);
    items.forEach((item, index) => {
      console.log(`      ${index + 1}. ${item.name}`);
      console.log(`         - SHA: ${item.id.substring(0, 7)}`);
      console.log(`         - Type: ${item.type}`);
      console.log(`         - Auteur: ${item.metadata?.authorLogin || item.metadata?.author}`);
      console.log(`         - Date: ${item.metadata?.date}`);
      console.log(`         - URL: ${item.url || 'N/A'}`);
      if (item.metadata?.additions || item.metadata?.deletions) {
        console.log(`         - Changements: +${item.metadata?.additions || 0} -${item.metadata?.deletions || 0}`);
      }
    });
    console.log();

    // Test 4: Récupérer les commits d'un auteur spécifique
    if (items.length > 0 && items[0].metadata?.authorLogin) {
      const author = items[0].metadata.authorLogin;
      console.log(`👤 Test 4: Récupération des commits de l'auteur "${author}"`);
      const authorCommits = await connector.fetchItems({
        author,
        //since: sevenDaysAgo.toISOString(),
        maxCommits: 5,
      });
      console.log(`   ✅ ${authorCommits.length} commit(s) de ${author} trouvé(s)\n`);
    }

    // Test 5: Récupérer la snapshot du premier commit
    if (items.length > 0) {
      const commitSha = items[0].id;
      console.log(`📸 Test 5: Récupération de la snapshot du commit ${commitSha.substring(0, 7)}`);
      const snapshot = await connector.fetchItemContent(commitSha);
      
      console.log("   ✅ Snapshot récupérée:");
      console.log(JSON.stringify(snapshot));
      //console.log(`      - Commit SHA: ${snapshot.commit.sha.substring(0, 7)}`);
      //console.log(`      - Message: ${snapshot.commit.message.split('\n')[0]}`);
      //console.log(`      - Auteur: ${snapshot.commit.author.name} (${snapshot.commit.author.login || 'N/A'})`);
      //console.log(`      - Date: ${snapshot.commit.author.date}`);
      //console.log(`      - Stats: +${snapshot.commit.stats.additions} -${snapshot.commit.stats.deletions}`);
      //console.log(`      - Repository: ${snapshot.repository.fullName}`);
    }

    // Test 6: Déconnexion
    console.log("🔌 Test 6: Déconnexion");
    await connector.disconnect();
    console.log("   ✅ Déconnecté\n");

    console.log("✅ Tous les tests sont passés!");
  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testGitHubExternalConnector();