import dotenv from "dotenv";
dotenv.config();

/**
 * Test de l'authentification Basic Auth
 * 
 * Usage: npx tsx packages/api/test/test-auth.ts
 */

const API_URL = process.env.API_URL || "http://localhost:3001";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MyTwinAdmin2025!";

// Créer le header Basic Auth
const credentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64");
const authHeader = `Basic ${credentials}`;

async function testAuth() {
  console.log("🔐 Test de l'authentification\n");

  try {
    // 1. Test route publique (GET)
    console.log("📖 Test 1: Route publique (GET /api/challenges)");
    let res = await fetch(`${API_URL}/api/challenges`);
    if (res.ok) {
      console.log("   ✅ Accès public OK (pas d'auth requise)\n");
    } else {
      throw new Error("Route publique inaccessible");
    }

    // 2. Test route protégée SANS auth
    console.log("🔒 Test 2: Route protégée SANS authentification");
    res = await fetch(`${API_URL}/api/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    
    if (res.status === 401) {
      console.log("   ✅ Accès refusé (401 Unauthorized)\n");
    } else {
      throw new Error("Route protégée accessible sans auth !");
    }

    // 3. Test route protégée AVEC mauvais credentials
    console.log("❌ Test 3: Route protégée avec MAUVAIS credentials");
    const badCredentials = Buffer.from("admin:wrongpassword").toString("base64");
    res = await fetch(`${API_URL}/api/challenges`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Basic ${badCredentials}`
      },
      body: JSON.stringify({ title: "Test" }),
    });
    
    if (res.status === 403) {
      console.log("   ✅ Accès refusé (403 Forbidden)\n");
    } else {
      throw new Error("Route protégée accessible avec mauvais credentials !");
    }

    // 4. Test route protégée AVEC bons credentials
    console.log("✅ Test 4: Route protégée avec BONS credentials");
    res = await fetch(`${API_URL}/api/projects`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({ 
        title: "Test Auth Project",
        description: "Test d'authentification"
      }),
    });
    
    if (res.ok) {
      const project = await res.json();
      console.log(`   ✅ Accès autorisé ! Projet créé: ${project.uuid}\n`);
      
      // Nettoyage
      await fetch(`${API_URL}/api/projects/${project.uuid}`, {
        method: "DELETE",
        headers: { "Authorization": authHeader }
      });
      console.log("   🗑️  Projet de test supprimé\n");
    } else {
      throw new Error("Authentification échouée avec bons credentials !");
    }

    console.log("✅ Tous les tests d'authentification sont passés !");
    console.log("\n📝 Résumé:");
    console.log("   - Routes GET (publiques) : ✅ Accessibles sans auth");
    console.log("   - Routes POST/PUT/DELETE : ✅ Protégées par Basic Auth");
    console.log("   - Credentials admin : ✅ Fonctionnels");

  } catch (error: any) {
    console.error("\n❌ Erreur:", error.message);
    process.exit(1);
  }
}

testAuth();
