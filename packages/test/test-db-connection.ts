import dotenv from "dotenv";
dotenv.config();

import { db } from "../database-service/db/drizzle.js";
import { sql } from "drizzle-orm";

//npx tsx test/test-db-connection.ts

async function testConnection() {
  try {
    const result = await db.execute(sql`SELECT NOW()`);
    console.log("✅ Connexion DB réussie !");
    console.log("   Heure du serveur:", result.rows[0]);
  } catch (error: any) {
    console.error("❌ Erreur de connexion:", error.message);
  }
}

testConnection();