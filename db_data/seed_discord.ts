import { eq } from "drizzle-orm";
import { db, users, discord_accounts, discord_evaluations, contributions } from "../packages/database-service/db/drizzle.js";
import { randomUUID } from "crypto";

/** npx tsx db_data/seed_discord.ts **/

async function seedDiscord() {
  console.log("🎮 Seeding Discord data...");

  // 1. Récupérer les users existants
  const existingUsers = await db.select().from(users);
  if (existingUsers.length < 2) {
    console.error("❌ Pas assez d'utilisateurs en base. Lance d'abord npm run populate-db");
    process.exit(1);
  }

  // 2. Supprimer les données Discord existantes
  await db.delete(discord_evaluations);
  await db.delete(discord_accounts);
  await db.delete(contributions).where(eq(contributions.type, "discord_help"));
  console.log("  ✓ Anciennes données Discord supprimées");

  // 3. Créer des comptes Discord liés aux users
  const discordUsers = [
    { discord_id: "123456789012345678", username: "Antoine#1234", user_id: existingUsers[0].uuid },
    { discord_id: "234567890123456789", username: "Alix#5678", user_id: existingUsers[1].uuid },
    { discord_id: "345678901234567890", username: "Victor#9012", user_id: existingUsers[2]?.uuid ?? null },
    { discord_id: "456789012345678901", username: "Samir#3456", user_id: existingUsers[3]?.uuid ?? null },
  ];

  for (const acc of discordUsers) {
    await db.insert(discord_accounts).values(acc);
  }
  console.log(`  ✓ ${discordUsers.length} discord_accounts insérés`);

  // 4. Créer des évaluations Discord
  const now = new Date();
  const evaluations = [
    {
      uuid: randomUUID(),
      channel_id: "111222333444555666",
      trigger_message_id: "999888777666555444",
      emoji: "🙏",
      helper_discord_id: discordUsers[0].discord_id,
      beneficiary_discord_id: discordUsers[1].discord_id,
      status: "evaluated",
      score: 82,
      notes: { justification: "Aide claire et détaillée sur un bug TypeScript complexe.", criteria: [] },
      evaluated_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      uuid: randomUUID(),
      channel_id: "111222333444555666",
      trigger_message_id: "888777666555444333",
      emoji: "🙏",
      helper_discord_id: discordUsers[1].discord_id,
      beneficiary_discord_id: discordUsers[2].discord_id,
      status: "evaluated",
      score: 65,
      notes: { justification: "Explication correcte mais pourrait être plus précise.", criteria: [] },
      evaluated_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      uuid: randomUUID(),
      channel_id: "111222333444555666",
      trigger_message_id: "777666555444333222",
      emoji: "🙏",
      helper_discord_id: discordUsers[0].discord_id,
      beneficiary_discord_id: discordUsers[3].discord_id,
      status: "skipped",
      score: null,
      notes: { skip_reason: "Conversation trop courte pour être évaluée." },
      evaluated_at: now,
      created_at: now,
    },
    {
      uuid: randomUUID(),
      channel_id: "222333444555666777",
      trigger_message_id: "666555444333222111",
      emoji: "🙏",
      helper_discord_id: discordUsers[2].discord_id,
      beneficiary_discord_id: discordUsers[0].discord_id,
      status: "evaluated",
      score: 91,
      notes: { justification: "Aide exemplaire avec code fonctionnel et explications pédagogiques.", criteria: [] },
      evaluated_at: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      uuid: randomUUID(),
      channel_id: "222333444555666777",
      trigger_message_id: "555444333222111000",
      emoji: "🙏",
      helper_discord_id: discordUsers[1].discord_id,
      beneficiary_discord_id: discordUsers[0].discord_id,
      status: "pending",
      score: null,
      notes: null,
      evaluated_at: null,
      created_at: now,
    },
  ];

  for (const ev of evaluations) {
    await db.insert(discord_evaluations).values(ev);
  }
  console.log(`  ✓ ${evaluations.length} discord_evaluations insérées`);

  // 5. Créer des contributions discord_help pour les évaluations réussies
  const evaluated = evaluations.filter(e => e.status === "evaluated" && e.score !== null);
  for (const ev of evaluated) {
    const helperUser = discordUsers.find(d => d.discord_id === ev.helper_discord_id);
    if (!helperUser?.user_id) continue;

    await db.insert(contributions).values({
      uuid: randomUUID(),
      title: "Aide Discord",
      type: "discord_help",
      description: (ev.notes as any)?.justification ?? "",
      reward: Math.round((ev.score! / 100) * 50), // 0-50 CP selon le score
      user_id: helperUser.user_id,
      challenge_id: null,
      evaluation: ev.notes,
      submitted_at: ev.evaluated_at!,
    });
  }
  console.log(`  ✓ ${evaluated.length} contributions discord_help insérées`);

  console.log("\n✅ Seed Discord terminé !");
  process.exit(0);
}

seedDiscord().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});