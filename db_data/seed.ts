import { db, projects, users, challenges, contributions, challenge_teams } from "../packages/database-service/db/drizzle.js";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

/** npx tsx db_data/seed.ts **/

// Mapping des anciens IDs vers les nouveaux UUIDs
const projectIdMap = new Map<number, string>();
const userIdMap = new Map<number, string>();
const challengeIdMap = new Map<number, string>();

async function seed() {
  // 1. Charger les JSON
  const projectsData = JSON.parse(readFileSync("./db_data/projects.json", "utf-8"));
  const usersData = JSON.parse(readFileSync("./db_data/users.json", "utf-8"));
  const challengesData = JSON.parse(readFileSync("./db_data/challenges.json", "utf-8"));
  const contributionsData = JSON.parse(readFileSync("./db_data/contributions.json", "utf-8"));

  // 2. Insérer les projects
  for (const p of projectsData) {
    const newUuid = randomUUID();
    projectIdMap.set(p.uuid, newUuid);
    await db.insert(projects).values({
      uuid: newUuid,
      title: p.title,
      description: p.description,
    });
  }
  console.log(`✓ ${projectsData.length} projects insérés`);

  // 3. Insérer les users
  for (const u of usersData) {
    const newUuid = randomUUID();
    userIdMap.set(u.uuid, newUuid);
    await db.insert(users).values({
      uuid: newUuid,
      role: u.role,
      full_name: u.full_name,
      github_username: u.github_username || "unknown",
    });
  }
  console.log(`✓ ${usersData.length} users insérés`);

  // 4. Insérer les challenges
  for (const c of challengesData) {
    const newUuid = randomUUID();
    challengeIdMap.set(c.uuid, newUuid);
    await db.insert(challenges).values({
      uuid: newUuid,
      index: c.index,
      title: c.title,
      status: c.completion === 1.0 ? "completed" : "active",
      start_date: c.start_date,
      end_date: c.end_date,
      description: c.description,
      roadmap: c.roadmap,
      contribution_points_reward: c.contribution_points_reward,
      completion: c.completion ?? 0,
      project_id: projectIdMap.get(c.project_id),
    });
  }
  console.log(`✓ ${challengesData.length} challenges insérés`);

  // 5. Insérer les contributions
  for (const c of contributionsData) {
    await db.insert(contributions).values({
      uuid: randomUUID(),
      title: c.title,
      type: "code", // Valeur par défaut car non présent dans JSON
      description: c.description,
      reward: c.reward,
      user_id: userIdMap.get(c.user_id),
      challenge_id: challengeIdMap.get(c.challenge_id),
    });
  }
  console.log(`✓ ${contributionsData.length} contributions insérées`);

    // 6. Insérer les challenge_teams (déduits des contributions)
  const teamSet = new Set<string>();
  for (const c of contributionsData) {
    const challengeUuid = challengeIdMap.get(c.challenge_id);
    const userUuid = userIdMap.get(c.user_id);
    if (!challengeUuid || !userUuid) continue;
    
    const key = `${challengeUuid}-${userUuid}`;
    if (teamSet.has(key)) continue; // Éviter les doublons
    teamSet.add(key);
    
    await db.insert(challenge_teams).values({
      challenge_id: challengeUuid,
      user_id: userUuid,
    });
  }
  console.log(`✓ ${teamSet.size} challenge_teams insérés`);

  console.log("\n✅ Seed terminé avec succès!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});