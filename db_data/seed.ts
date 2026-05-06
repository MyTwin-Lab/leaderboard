import { db, projects, users, challenges, contributions, challenge_teams } from "../packages/database-service/db/drizzle.js";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

/**
 * Additive seed — inserts only missing data, never deletes or overwrites.
 * Safe to run multiple times, even with existing OAuth users in DB.
 *
 * Usage:
 *   npx tsx db_data/seed.ts          # additive seed
 *   npx tsx db_data/seed.ts --force  # reset everything + re-seed (DESTRUCTIVE)
 */

// Mapping: JSON numeric id → DB uuid
const projectIdMap = new Map<number, string>();
const userIdMap = new Map<number, string>();
const challengeIdMap = new Map<number, string>();

async function seed() {
  console.log("🌱 Additive seed — checking what's missing...\n");

  const projectsData = JSON.parse(readFileSync("./db_data/projects.json", "utf-8"));
  const usersData = JSON.parse(readFileSync("./db_data/users.json", "utf-8"));
  const challengesData = JSON.parse(readFileSync("./db_data/challenges.json", "utf-8"));
  const contributionsData = JSON.parse(readFileSync("./db_data/contributions.json", "utf-8"));

  // --- Projects (deduplicate by title) ---
  let projectsInserted = 0;
  for (const p of projectsData) {
    const existing = await db.select({ uuid: projects.uuid })
      .from(projects)
      .where(eq(projects.title, p.title))
      .limit(1);

    if (existing.length > 0) {
      projectIdMap.set(p.uuid, existing[0].uuid);
    } else {
      const newUuid = randomUUID();
      projectIdMap.set(p.uuid, newUuid);
      await db.insert(projects).values({
        uuid: newUuid,
        title: p.title,
        description: p.description,
      });
      projectsInserted++;
    }
  }
  console.log(`✓ Projects: ${projectsInserted} inserted, ${projectsData.length - projectsInserted} already exist`);

  // --- Users (deduplicate by github_username first, then full_name) ---
  // OAuth users may already exist with the same github_username but a different full_name.
  let usersInserted = 0;
  let usersLinked = 0;
  for (const u of usersData) {
    // 1. Try matching by github_username (unique index — most reliable)
    let existing: { uuid: string }[] = [];
    if (u.github_username) {
      existing = await db.select({ uuid: users.uuid })
        .from(users)
        .where(eq(users.github_username, u.github_username))
        .limit(1);
      if (existing.length > 0) usersLinked++;
    }

    // 2. Fallback: match by full_name
    if (existing.length === 0) {
      existing = await db.select({ uuid: users.uuid })
        .from(users)
        .where(eq(users.full_name, u.full_name))
        .limit(1);
    }

    if (existing.length > 0) {
      userIdMap.set(u.uuid, existing[0].uuid);
    } else {
      const newUuid = randomUUID();
      userIdMap.set(u.uuid, newUuid);
      await db.insert(users).values({
        uuid: newUuid,
        role: u.role,
        full_name: u.full_name,
        github_username: u.github_username || null,
        bio: u.bio,
      });
      usersInserted++;
    }
  }
  console.log(`✓ Users: ${usersInserted} inserted, ${usersLinked} linked to existing OAuth users, ${usersData.length - usersInserted - usersLinked} already exist`);

  // --- Challenges (deduplicate by index) ---
  let challengesInserted = 0;
  for (const c of challengesData) {
    const existing = await db.select({ uuid: challenges.uuid })
      .from(challenges)
      .where(eq(challenges.index, c.index))
      .limit(1);

    if (existing.length > 0) {
      challengeIdMap.set(c.uuid, existing[0].uuid);
    } else {
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
      challengesInserted++;
    }
  }
  console.log(`✓ Challenges: ${challengesInserted} inserted, ${challengesData.length - challengesInserted} already exist`);

  // --- Contributions (deduplicate by title + user_id + challenge_id) ---
  // Load all existing contributions once to avoid N+1 queries
  const existingContributions = await db
    .select({ title: contributions.title, user_id: contributions.user_id, challenge_id: contributions.challenge_id })
    .from(contributions);
  const contribKeys = new Set(existingContributions.map(c => `${c.title}|${c.user_id}|${c.challenge_id}`));

  let contributionsInserted = 0;
  let contributionsSkipped = 0;
  for (const c of contributionsData) {
    const userId = userIdMap.get(c.user_id);
    const challengeId = challengeIdMap.get(c.challenge_id);

    if (!userId || !challengeId) {
      contributionsSkipped++;
      continue;
    }

    const key = `${c.title}|${userId}|${challengeId}`;
    if (contribKeys.has(key)) {
      contributionsSkipped++;
      continue;
    }

    await db.insert(contributions).values({
      uuid: randomUUID(),
      title: c.title,
      type: "code",
      description: c.description,
      reward: c.reward,
      user_id: userId,
      challenge_id: challengeId,
      submitted_at: c.submitted_at ? new Date(c.submitted_at) : new Date(),
    });
    contribKeys.add(key);
    contributionsInserted++;
  }
  console.log(`✓ Contributions: ${contributionsInserted} inserted, ${contributionsSkipped} skipped`);

  // --- Challenge teams (deduplicate by challenge + user pair) ---
  const existingTeams = await db
    .select({ challenge_id: challenge_teams.challenge_id, user_id: challenge_teams.user_id })
    .from(challenge_teams);
  const teamKeys = new Set(existingTeams.map(t => `${t.challenge_id}|${t.user_id}`));

  let teamsInserted = 0;
  for (const c of contributionsData) {
    const challengeUuid = challengeIdMap.get(c.challenge_id);
    const userUuid = userIdMap.get(c.user_id);
    if (!challengeUuid || !userUuid) continue;

    const key = `${challengeUuid}|${userUuid}`;
    if (teamKeys.has(key)) continue;
    teamKeys.add(key);

    await db.insert(challenge_teams).values({
      challenge_id: challengeUuid,
      user_id: userUuid,
    });
    teamsInserted++;
  }
  console.log(`✓ Challenge teams: ${teamsInserted} inserted`);

  console.log("\n✅ Seed terminé avec succès!");
  process.exit(0);
}

// --force: reset everything + re-seed (DESTRUCTIVE — will delete OAuth users!)
async function resetAll() {
  console.log("⚠️  --force: Resetting ALL data (including OAuth users)...\n");

  await db.delete(challenge_teams);
  console.log("  ✓ challenge_teams cleared");
  await db.delete(contributions);
  console.log("  ✓ contributions cleared");
  await db.delete(challenges);
  console.log("  ✓ challenges cleared");
  await db.delete(users);
  console.log("  ✓ users cleared");
  await db.delete(projects);
  console.log("  ✓ projects cleared");

  console.log("✅ Database reset complete!\n");
}

async function main() {
  if (process.argv.includes("--force")) {
    await resetAll();
  }
  await seed();
}

main().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
