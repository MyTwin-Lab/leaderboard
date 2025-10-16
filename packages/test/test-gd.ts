import { GoogleDriveConnector } from "../connectors/implementation/GD.connector.js";

//npx ts-node test/test-gd.ts

async function testGoogleDrive2() {
  console.log("🧪 Test du GoogleDrive2Connector (ExternalConnector)\n");

  const connector = new GoogleDriveConnector({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
    redirectUri: "http://localhost:3000/oauth/callback",
  });

  try {
    // Test 1: Connexion
    console.log("📡 Test 1: Connexion au service Google Drive");
    await connector.connect();
    console.log("   ✅ Connexion établie\n");

    // Test 2: Test de connexion
    console.log("🔍 Test 2: Vérification de la connexion");
    const isConnected = await connector.testConnection();
    console.log(`   ${isConnected ? '✅' : '❌'} Connexion ${isConnected ? 'valide' : 'invalide'}\n`);

    if (!isConnected) {
      throw new Error("La connexion a échoué");
    }

    // Test 3: Récupérer les fichiers d'un dossier spécifique
    const folderId = process.env.GOOGLE_FOLDER_ID || "13VqOYbKVo5N_7mJKvGS3KFDBNCqkj2eT";
    console.log(`📋 Test 3: Récupération des fichiers du dossier ${folderId}`);
    const items = await connector.fetchItems({ 
      folderId,
      pageSize: 10,
      orderBy: "modifiedTime desc"
    });
    
    console.log(`   ✅ ${items.length} élément(s) récupéré(s):`);
    items.forEach((item, index) => {
      console.log(`      ${index + 1}. ${item.name}`);
      console.log(`         - ID: ${item.id}`);
      console.log(`         - Type: ${item.type}`);
      console.log(`         - URL: ${item.url || 'N/A'}`);
      console.log(`         - MIME: ${item.metadata?.mimeType || 'N/A'}`);
      console.log(`         - Modifié: ${item.metadata?.modifiedTime || 'N/A'}`);
    });
    console.log();
    
    // Test 4: Récupérer le contenu du premier fichier (si disponible)
    if (items.length > 0 && items[0].type !== 'folder') {
      console.log(`📄 Test 4: Récupération du contenu de "${items[0].name}"`);
      const content = await connector.fetchItemContent(items[0].id);
      
      console.log("   ✅ Contenu récupéré:");
      console.log(`      - Type: ${content.type}`);
      console.log(`      - MIME: ${content.mimeType || 'N/A'}`);
      
      if (typeof content.content === 'string') {
        const preview = content.content.substring(0, 200);
        console.log(`      - Aperçu: ${preview}${content.content.length > 200 ? '...' : ''}`);
      } else if (Buffer.isBuffer(content.content)) {
        console.log(`      - Taille: ${content.content.length} bytes`);
      }
      console.log();
    }

    // Test 5: Recherche de fichiers par type MIME
    console.log("🔎 Test 5: Recherche de fichiers texte");
    const textFiles = await connector.fetchItems({
      folderId,
      mimeType: "text/plain",
      pageSize: 5
    });
    console.log(`   ✅ ${textFiles.length} fichier(s) texte trouvé(s)\n`);

    // Test 6: Déconnexion
    console.log("🔌 Test 6: Déconnexion");
    await connector.disconnect();
    console.log("   ✅ Déconnecté\n");

    console.log("✅ Tous les tests sont passés!");
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  }
}

testGoogleDrive2();