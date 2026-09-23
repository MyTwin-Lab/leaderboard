import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  projects,
  users,
  repos,
  challenges,
  challenge_repos,
  challenge_teams,
  contributions,
  reward_entries,
  challenge_signals,
  onboarding_progress,
  sandboxes,
  sandbox_stars,
  sandbox_rewards,
  evaluation_grids,
  evaluation_grid_categories,
  evaluation_grid_subcriteria,
  validation_targets,
  validation_scenario_steps,
} from "../packages/database-service/db/drizzle.js";
import {
  AppSettingsRepository,
  ProjectRepository,
  SandboxRepository,
} from "../packages/database-service/repositories/index.js";
import { ChallengeRepository } from "../packages/database-service/repositories/challenge.repo.js";
import { SLUG_FALLBACK, slugify } from "../packages/database-service/domain/slug.js";
import {
  SandboxService,
  SandboxPromotionService,
  hashIp,
} from "../packages/services/sandbox/index.js";
import { logBriefs, logHosts } from "./challenge-content.js";

/**
 * Le seed du Leaderboard — un seul fichier, trois étages.
 *
 *   1. Les données de production, dérivées d'un dump et figées dans
 *      `db_data/*.json`. C'est l'essentiel : projets, contributeurs,
 *      challenges, dépôts, contributions, récompenses, signaux, grilles
 *      d'évaluation, onboarding, propositions du Sandbox.
 *   2. Le challenge de validation MyCoach (MyKine), qui n'existe pas en prod
 *      mais qui est le seul exemple de validation en mode scénario.
 *   3. Les propositions de démonstration du Sandbox, derrière `--demo`.
 *
 * Les fichiers JSON ne s'écrivent pas à la main : ils sont régénérés depuis un
 * dump de prod par `scripts/dump-to-seed-data.mjs`. Voir `db_data/README.md`.
 *
 * Usage :
 *   npx tsx db_data/seed.ts            # additif — n'insère que ce qui manque
 *   npx tsx db_data/seed.ts --demo     # + les propositions de démo du Sandbox
 *   npx tsx db_data/seed.ts --force    # vide tout, puis re-seed (DESTRUCTIF)
 *
 * **Additif par défaut, et ça n'est pas un détail** : ce seed tourne aussi
 * contre la production (`scripts/prod.sh`, `db:setup`, `populate-db`). Chaque
 * objet est reconnu à son identifiant de production avant d'être inséré, donc
 * le rejouer ne duplique rien et n'écrase rien — en particulier pas les
 * comptes OAuth créés depuis. Voir `bySeedUuid` : dédupliquer sur le nom, lui,
 * fusionnerait les homonymes bien réels de la production.
 *
 * **Pourquoi `--demo` existe.** Les propositions de démonstration se font
 * starer, et une star franchissant un palier **paie de vrais CP** dans
 * `sandbox_rewards`, qui remontent au classement. Ces CP n'ont rien à faire
 * dans une base réelle : l'étage 3 est donc inerte tant qu'on ne le demande
 * pas. Tout le reste est sans effet de bord sur l'économie.
 *
 * Les identifiants de production sont conservés tels quels à l'insertion :
 * les clés étrangères des fichiers JSON se recâblent donc sans traduction.
 * Quand un objet existe déjà sous un autre identifiant, la table de
 * correspondance ci-dessous rattrape le tir.
 */

const DATA_DIR = "./db_data";

const flags = {
  force: process.argv.includes("--force"),
  demo: process.argv.includes("--demo"),
};

/**
 * uuid de production → uuid réellement en base.
 *
 * Un seul espace pour toutes les tables : un uuid est unique globalement, et
 * ça évite de promener une table par entité. Les deux se confondent pour tout
 * ce que ce seed insère lui-même ; ils divergent quand l'objet existait déjà
 * (un compte OAuth, un challenge créé à la main).
 */
const ids = new Map<string, string>();

/** L'uuid en base d'une référence de production. `null` si la cible manque. */
function ref(prodUuid: string | null | undefined): string | null {
  if (!prodUuid) return null;
  return ids.get(prodUuid) ?? null;
}

/**
 * L'objet déjà en base sous cet identifiant de production.
 *
 * **C'est la seule clé de déduplication fiable.** La production porte de vrais
 * homonymes — deux comptes « Alix Chagot », deux « Antoine Tessier », trois
 * paires de dépôts au même titre, deux contributions « Community Management »
 * du même auteur sur le même challenge. Dédupliquer sur le nom les ferait
 * fusionner, et le seed produirait 18 contributeurs là où la prod en a 20.
 *
 * Comme ce seed réinsère les uuid de production tels quels, les retrouver
 * suffit à le rendre rejouable. Les clés naturelles ne servent plus qu'à une
 * chose : rattacher un objet à une ligne que ce seed n'a pas écrite — un
 * compte OAuth, un challenge créé à la main.
 */
async function bySeedUuid(table: any, prodUuid: string): Promise<string | null> {
  const [row] = await db.select({ uuid: table.uuid }).from(table).where(eq(table.uuid, prodUuid)).limit(1);
  return row?.uuid ?? null;
}

/**
 * Les lignes déjà rattachées à un objet du seed, par table.
 *
 * Sans ça, une recherche par clé naturelle rendrait la même ligne à deux
 * objets distincts — exactement ce qui fait disparaître un homonyme.
 */
const claimed = new Map<string, Set<string>>();

function claim(table: string, uuid: string): void {
  const set = claimed.get(table) ?? new Set<string>();
  set.add(uuid);
  claimed.set(table, set);
}

function isClaimed(table: string, uuid: string): boolean {
  return claimed.get(table)?.has(uuid) ?? false;
}

/** Les fichiers JSON portent des clés `_comment` pour rester lisibles. */
function read<T>(file: string): T {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${file}`, "utf-8"));
  return strip(raw) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => [k, strip(v)])
    );
  }
  return value;
}

/**
 * Un `timestamp` de dump (« 2026-03-19 16:19:14.12958 ») vers une Date.
 *
 * Lu comme de l'UTC, et non comme de l'heure locale : la session Postgres est
 * forcée en UTC (voir le commentaire du pool dans `drizzle.ts`), donc relire
 * cette Date redonne exactement l'heure murale du dump. Sans le `Z`, un seed
 * lancé à Paris décalerait toute la base de deux heures.
 */
function ts(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value.replace(" ", "T") + "Z");
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Insert brut (uuid imposé) : le repository ne pose pas le slug à notre place. */
function freeChallengeSlug(title: string): Promise<string> {
  return new ChallengeRepository().availableSlug(slugify(title, SLUG_FALLBACK.challenge));
}

// ---------------------------------------------------------------------------
// Étage 1 — les données de production
// ---------------------------------------------------------------------------

async function seedProjects() {
  const data = read<any[]>("projects.json");
  let inserted = 0;

  for (const p of data) {
    const seeded = await bySeedUuid(projects, p.uuid);
    if (seeded) {
      ids.set(p.uuid, seeded);
      claim("projects", seeded);
      continue;
    }

    const [existing] = await db
      .select({ uuid: projects.uuid })
      .from(projects)
      .where(eq(projects.title, p.title))
      .limit(1);

    if (existing && !isClaimed("projects", existing.uuid)) {
      ids.set(p.uuid, existing.uuid);
      claim("projects", existing.uuid);
      continue;
    }

    await db.insert(projects).values({
      uuid: p.uuid,
      title: p.title,
      description: p.description,
    });
    ids.set(p.uuid, p.uuid);
    claim("projects", p.uuid);
    inserted++;
  }

  console.log(`✓ Projects: ${inserted} inserted, ${data.length - inserted} already exist`);
}

/**
 * Les contributeurs. Reconnus d'abord au compte GitHub — c'est l'index unique,
 * et donc le seul rattachement fiable à un compte OAuth déjà créé —, puis au
 * nom complet.
 *
 * Ni email, ni `google_user_id`, ni avatar : ce sont des données de compte, le
 * générateur les écarte du JSON, et elles se reposent seules à la première
 * connexion. Un seed ne doit pas fabriquer d'identité connectable.
 */
async function seedUsers() {
  const data = read<any[]>("users.json");
  let inserted = 0;
  let linked = 0;

  // Les noms portés par plus d'une personne : le nom ne peut pas les départager.
  const counts = new Map<string, number>();
  for (const u of data) counts.set(u.full_name, (counts.get(u.full_name) ?? 0) + 1);
  const ambiguousNames = new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name));

  for (const u of data) {
    const seeded = await bySeedUuid(users, u.uuid);
    if (seeded) {
      ids.set(u.uuid, seeded);
      claim("users", seeded);
      continue;
    }

    let match: string | null = null;

    // Le compte GitHub d'abord : c'est l'index unique, donc le seul
    // rattachement fiable à un compte OAuth déjà créé.
    if (u.github_username) {
      const [row] = await db
        .select({ uuid: users.uuid })
        .from(users)
        .where(eq(users.github_username, u.github_username))
        .limit(1);
      if (row && !isClaimed("users", row.uuid)) {
        match = row.uuid;
        linked++;
      }
    }

    // Le nom complet ensuite, et seulement s'il désigne une seule personne :
    // la production compte deux « Alix Chagot » et deux « Antoine Tessier ».
    if (!match && !ambiguousNames.has(u.full_name)) {
      const [row] = await db
        .select({ uuid: users.uuid })
        .from(users)
        .where(eq(users.full_name, u.full_name))
        .limit(1);
      if (row && !isClaimed("users", row.uuid)) match = row.uuid;
    }

    if (match) {
      ids.set(u.uuid, match);
      claim("users", match);
      continue;
    }

    await db.insert(users).values({
      uuid: u.uuid,
      role: u.role,
      full_name: u.full_name,
      github_username: u.github_username ?? null,
      bio: u.bio,
      created_at: ts(u.created_at) ?? new Date(),
    });
    ids.set(u.uuid, u.uuid);
    inserted++;
  }

  console.log(
    `✓ Users: ${inserted} inserted, ${linked} linked to existing OAuth users, ` +
      `${data.length - inserted - linked} already exist`
  );
}

async function seedRepos() {
  const data = read<any[]>("repos.json");
  let inserted = 0;

  for (const r of data) {
    const seeded = await bySeedUuid(repos, r.uuid);
    if (seeded) {
      ids.set(r.uuid, seeded);
      claim("repos", seeded);
      continue;
    }

    const projectId = ref(r.project_id);
    // (titre, type) ne suffit pas : trois paires de dépôts de production le
    // partagent, sur des challenges différents. Le projet les départage, et
    // une ligne déjà rattachée ne peut pas l'être deux fois.
    const [existing] = await db
      .select({ uuid: repos.uuid })
      .from(repos)
      .where(and(eq(repos.title, r.title), eq(repos.type, r.type)))
      .limit(1);

    if (existing && !isClaimed("repos", existing.uuid)) {
      ids.set(r.uuid, existing.uuid);
      claim("repos", existing.uuid);
      continue;
    }

    await db.insert(repos).values({
      uuid: r.uuid,
      title: r.title,
      type: r.type,
      external_repo_id: r.external_repo_id,
      project_id: projectId,
    });
    ids.set(r.uuid, r.uuid);
    claim("repos", r.uuid);
    inserted++;
  }

  console.log(`✓ Repos: ${inserted} inserted, ${data.length - inserted} already exist`);
}

/**
 * Les challenges, reconnus à leur **slug**.
 *
 * Pas à `index` comme autrefois : c'est un `serial`, la production en compte
 * quatre paires de doublons (5, 6, 7 et 8 deux fois), et il ne désigne donc
 * plus rien. Le générateur ne le reprend pas — Postgres l'attribue.
 *
 * `source_challenge_id` est posé dans une seconde passe : il pointe un autre
 * challenge, qui peut n'être inséré qu'après celui qui le cite.
 */
async function seedChallenges() {
  const data = read<any[]>("challenges.json");
  let inserted = 0;

  for (const c of data) {
    const seeded = await bySeedUuid(challenges, c.uuid);
    if (seeded) {
      ids.set(c.uuid, seeded);
      claim("challenges", seeded);
      continue;
    }

    const [existing] = await db
      .select({ uuid: challenges.uuid })
      .from(challenges)
      .where(eq(challenges.slug, c.slug))
      .limit(1);

    if (existing && !isClaimed("challenges", existing.uuid)) {
      ids.set(c.uuid, existing.uuid);
      claim("challenges", existing.uuid);
      continue;
    }

    await db.insert(challenges).values({
      uuid: c.uuid,
      title: c.title,
      slug: await freeChallengeSlug(c.title),
      status: c.status,
      type: c.type,
      start_date: c.start_date,
      end_date: c.end_date,
      description: c.description,
      roadmap: c.roadmap,
      contribution_points_reward: c.contribution_points_reward,
      completion: c.completion ?? 0,
      project_id: ref(c.project_id),
      reward_rules: c.reward_rules,
      cp_per_validation: c.cp_per_validation,
      required_validations: c.required_validations,
      compute_enabled: c.compute_enabled ?? false,
      workspace_mode: c.workspace_mode ?? "provided_repo",
      // La couverture ne vient pas de la production, qui n'a pas encore la
      // colonne, mais de `COVER_IMAGES` dans le générateur. Sans elle, la
      // carte retombe sur la banque d'images de la landing
      // (apps/leaderboard-client/src/lib/coverImage.ts).
      cover_image_url: c.cover_image_url ?? null,
      // L'hôte reste vide : `logHosts()` posera ceux de démonstration si on
      // les demande, et en production il se saisit dans le tiroir d'admin.
      host: null,
      created_at: ts(c.created_at) ?? new Date(),
      closed_at: ts(c.closed_at),
    });
    ids.set(c.uuid, c.uuid);
    claim("challenges", c.uuid);
    inserted++;
  }

  // Seconde passe : les challenges de validation adossés à un challenge source.
  let linked = 0;
  for (const c of data) {
    if (!c.source_challenge_id) continue;
    const self = ref(c.uuid);
    const source = ref(c.source_challenge_id);
    if (!self || !source) continue;
    await db.update(challenges).set({ source_challenge_id: source }).where(eq(challenges.uuid, self));
    linked++;
  }

  console.log(
    `✓ Challenges: ${inserted} inserted, ${data.length - inserted} already exist` +
      (linked ? `, ${linked} linked to their source challenge` : "")
  );
}

async function seedChallengeRepos() {
  const data = read<any[]>("challenge-repos.json");
  const existing = await db
    .select({ challenge_id: challenge_repos.challenge_id, repo_id: challenge_repos.repo_id })
    .from(challenge_repos);
  const seen = new Set(existing.map((r) => `${r.challenge_id}|${r.repo_id}`));

  let inserted = 0;
  for (const cr of data) {
    const challengeId = ref(cr.challenge_id);
    const repoId = ref(cr.repo_id);
    if (!challengeId || !repoId) continue;

    const key = `${challengeId}|${repoId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    await db.insert(challenge_repos).values({
      challenge_id: challengeId,
      repo_id: repoId,
      role: cr.role,
      workspace_provider: cr.workspace_provider,
      workspace_ref: cr.workspace_ref,
      workspace_url: cr.workspace_url,
      workspace_status: cr.workspace_status,
      workspace_meta: cr.workspace_meta,
    });
    inserted++;
  }

  console.log(`✓ Challenge repos: ${inserted} inserted, ${data.length - inserted} already exist`);
}

async function seedChallengeTeams() {
  const data = read<any[]>("challenge-teams.json");
  const existing = await db
    .select({ challenge_id: challenge_teams.challenge_id, user_id: challenge_teams.user_id })
    .from(challenge_teams);
  const seen = new Set(existing.map((t) => `${t.challenge_id}|${t.user_id}`));

  let inserted = 0;
  for (const t of data) {
    const challengeId = ref(t.challenge_id);
    const userId = ref(t.user_id);
    if (!challengeId || !userId) continue;

    const key = `${challengeId}|${userId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    await db.insert(challenge_teams).values({
      challenge_id: challengeId,
      user_id: userId,
      workspace_provider: t.workspace_provider,
      workspace_ref: t.workspace_ref,
      workspace_url: t.workspace_url,
      workspace_status: t.workspace_status,
      // Un groupe est un uuid partagé entre plusieurs lignes du même
      // challenge : il se traduit comme n'importe quelle référence.
      group_id: t.group_id ? (ref(t.group_id) ?? t.group_id) : null,
    });
    inserted++;
  }

  console.log(`✓ Challenge teams: ${inserted} inserted, ${data.length - inserted} already exist`);
}

/**
 * Les contributions, reconnues à leur identifiant de production.
 *
 * Pas au triplet (titre, auteur, challenge) : la production compte deux
 * contributions « Community Management » du même auteur sur le même
 * challenge, et ce triplet en perdait une.
 */
async function seedContributions() {
  const data = read<any[]>("contributions.json");

  let inserted = 0;
  let skipped = 0;
  for (const c of data) {
    const seeded = await bySeedUuid(contributions, c.uuid);
    if (seeded) {
      ids.set(c.uuid, seeded);
      skipped++;
      continue;
    }

    const userId = ref(c.user_id);
    const challengeId = ref(c.challenge_id);
    if (!userId || !challengeId) {
      skipped++;
      continue;
    }

    await db.insert(contributions).values({
      uuid: c.uuid,
      title: c.title,
      type: c.type ?? "code",
      description: c.description,
      evaluation: c.evaluation,
      tags: c.tags,
      reward: c.reward,
      user_id: userId,
      challenge_id: challengeId,
      // `tasks` est vide en production : aucune contribution n'y est rattachée.
      task_id: null,
      submitted_at: ts(c.submitted_at) ?? new Date(),
      artifact_url: c.artifact_url,
      evaluation_status: c.evaluation_status,
      live_endpoint_url: c.live_endpoint_url,
      created_at: ts(c.created_at) ?? new Date(),
    });
    ids.set(c.uuid, c.uuid);
    inserted++;
  }

  console.log(`✓ Contributions: ${inserted} inserted, ${skipped} skipped`);
}

/**
 * Le ledger des CP des challenges ML.
 *
 * Écrit tel quel, sans repasser par le moteur de règles : ces lignes sont le
 * résultat d'évaluations réelles, pas un état à recalculer. Les rejouer
 * donnerait d'autres montants, puisque le barème a bougé depuis.
 */
async function seedRewardEntries() {
  const data = read<any[]>("reward-entries.json");

  let inserted = 0;
  for (const r of data) {
    // À l'identifiant de production, et non à (challenge, auteur, règle,
    // contribution) : le ledger est un journal, trois lignes `dataset` du même
    // auteur sur le même challenge sont trois écritures, pas un doublon.
    if (await bySeedUuid(reward_entries, r.uuid)) continue;

    const challengeId = ref(r.challenge_id);
    const userId = ref(r.user_id);
    if (!challengeId || !userId) continue;

    const contributionId = ref(r.contribution_id);

    await db.insert(reward_entries).values({
      uuid: r.uuid,
      challenge_id: challengeId,
      user_id: userId,
      contribution_id: contributionId,
      rule_key: r.rule_key,
      points: r.points,
      source_user_id: ref(r.source_user_id),
      meta: r.meta,
      created_at: ts(r.created_at) ?? new Date(),
    });
    inserted++;
  }

  console.log(`✓ Reward entries: ${inserted} inserted, ${data.length - inserted} already exist`);
}

async function seedChallengeSignals() {
  const data = read<any[]>("challenge-signals.json");
  let inserted = 0;

  for (const s of data) {
    if (await bySeedUuid(challenge_signals, s.uuid)) continue;

    const challengeId = ref(s.challenge_id);
    if (!challengeId) continue;

    const [existing] = await db
      .select({ uuid: challenge_signals.uuid })
      .from(challenge_signals)
      .where(and(eq(challenge_signals.challenge_id, challengeId), eq(challenge_signals.label, s.label)))
      .limit(1);
    if (existing) continue;

    await db.insert(challenge_signals).values({
      uuid: s.uuid,
      challenge_id: challengeId,
      label: s.label,
      description: s.description,
      reward_cp: s.reward_cp,
      icon: s.icon,
      position: s.position,
      created_at: ts(s.created_at) ?? new Date(),
    });
    inserted++;
  }

  console.log(`✓ Challenge signals: ${inserted} inserted, ${data.length - inserted} already exist`);
}

async function seedOnboarding() {
  const data = read<any[]>("onboarding-progress.json");
  let inserted = 0;

  for (const o of data) {
    const userId = ref(o.user_id);
    if (!userId) continue;

    const [existing] = await db
      .select({ user_id: onboarding_progress.user_id })
      .from(onboarding_progress)
      .where(eq(onboarding_progress.user_id, userId))
      .limit(1);
    if (existing) continue;

    await db.insert(onboarding_progress).values({
      user_id: userId,
      clicked_challenge: o.clicked_challenge,
      assigned_task: o.assigned_task,
      evaluated_contribution: o.evaluated_contribution,
      validated_task: o.validated_task,
      joined_meeting: o.joined_meeting,
      completed_at: ts(o.completed_at),
      created_at: ts(o.created_at) ?? new Date(),
      updated_at: ts(o.updated_at) ?? new Date(),
    });
    inserted++;
  }

  console.log(`✓ Onboarding: ${inserted} inserted, ${data.length - inserted} already exist`);
}

/**
 * Les propositions du Sandbox venues de la production.
 *
 * Insert direct et non `SandboxService.create()` : le service pose un slug et
 * des dates de création, or ce sont justement les valeurs de production qu'on
 * veut retrouver. Aucune star n'est posée ici — la production n'en a aucune —,
 * donc rien ne paie de CP, contrairement à l'étage 3.
 */
async function seedSandboxes() {
  const data = read<any[]>("sandboxes.json");
  let inserted = 0;

  for (const s of data) {
    const seeded = await bySeedUuid(sandboxes, s.uuid);
    if (seeded) {
      ids.set(s.uuid, seeded);
      claim("sandboxes", seeded);
      continue;
    }

    const userId = ref(s.user_id);
    if (!userId) continue;

    const [existing] = await db
      .select({ uuid: sandboxes.uuid })
      .from(sandboxes)
      .where(eq(sandboxes.slug, s.slug))
      .limit(1);

    if (existing && !isClaimed("sandboxes", existing.uuid)) {
      ids.set(s.uuid, existing.uuid);
      claim("sandboxes", existing.uuid);
      continue;
    }

    await db.insert(sandboxes).values({
      uuid: s.uuid,
      user_id: userId,
      title: s.title,
      slug: s.slug,
      context: s.context,
      goals: s.goals ?? [],
      why: s.why,
      cover_image_url: null,
      status: s.status ?? "open",
      promoted_challenge_id: ref(s.promoted_challenge_id),
      promoted_at: ts(s.promoted_at),
      created_at: ts(s.created_at) ?? new Date(),
      updated_at: ts(s.updated_at) ?? new Date(),
    });
    ids.set(s.uuid, s.uuid);
    claim("sandboxes", s.uuid);
    inserted++;
  }

  console.log(`✓ Sandboxes: ${inserted} inserted, ${data.length - inserted} already exist`);
}

/** Les grilles d'évaluation, avec leurs catégories et sous-critères imbriqués. */
async function seedEvaluationGrids() {
  const data = read<any[]>("evaluation-grids.json");
  let inserted = 0;
  let categories = 0;
  let subcriteria = 0;

  for (const g of data) {
    const seeded = await bySeedUuid(evaluation_grids, g.id);
    if (seeded) {
      ids.set(g.id, seeded);
      continue;
    }

    const [existing] = await db
      .select({ uuid: evaluation_grids.uuid })
      .from(evaluation_grids)
      .where(eq(evaluation_grids.slug, g.slug))
      .limit(1);

    if (existing) {
      ids.set(g.id, existing.uuid);
      continue;
    }

    await db.insert(evaluation_grids).values({
      uuid: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      version: g.version,
      status: g.status,
      instructions: g.instructions,
      created_at: ts(g.created_at) ?? new Date(),
      updated_at: ts(g.updated_at) ?? new Date(),
      published_at: ts(g.published_at),
      created_by: ref(g.created_by),
    });
    ids.set(g.id, g.id);
    inserted++;

    for (const c of g.categories ?? []) {
      await db.insert(evaluation_grid_categories).values({
        uuid: c.id,
        grid_id: g.id,
        name: c.name,
        weight: c.weight,
        type: c.type,
        position: c.position,
      });
      categories++;

      for (const s of c.subcriteria ?? []) {
        await db.insert(evaluation_grid_subcriteria).values({
          uuid: s.id,
          category_id: c.id,
          criterion: s.criterion,
          description: s.description,
          weight: s.weight,
          metrics: s.metrics,
          indicators: s.indicators,
          scoring_excellent: s.scoring_excellent,
          scoring_good: s.scoring_good,
          scoring_average: s.scoring_average,
          scoring_poor: s.scoring_poor,
          position: s.position,
        });
        subcriteria++;
      }
    }
  }

  console.log(
    `✓ Evaluation grids: ${inserted} inserted (${categories} categories, ${subcriteria} subcriteria), ` +
      `${data.length - inserted} already exist`
  );
}

// ---------------------------------------------------------------------------
// Étage 2 — le challenge de validation MyCoach (MyKine)
// ---------------------------------------------------------------------------

/**
 * Un challenge de validation en **mode scénario**, adossé à un challenge
 * `code`, avec l'application MyCoach déjà déployée comme cible.
 *
 * Il n'existe pas en production, et c'est pour ça qu'il est ici plutôt que
 * dans les JSON : c'est le seul exemple de validation par parcours d'usage,
 * et la page de validation n'a rien d'autre à montrer sans lui.
 *
 * Sans effet sur l'économie : aucun verdict n'est prononcé, donc aucun CP
 * n'est distribué. Il reste hors de `--demo` à ce titre.
 */
async function seedMyKineValidation() {
  const data = read<any>("mykine-validation.json");

  // --- Le projet porteur ---
  let [project] = await db
    .select({ uuid: projects.uuid })
    .from(projects)
    .where(eq(projects.title, data.project.title))
    .limit(1);
  if (!project) {
    const uuid = randomUUID();
    await db.insert(projects).values({ uuid, ...data.project });
    project = { uuid };
  }

  // --- L'auteur : le propriétaire du dépôt ---
  let [author] = await db
    .select({ uuid: users.uuid })
    .from(users)
    .where(eq(users.github_username, data.author.github_username))
    .limit(1);
  if (!author) {
    [author] = await db
      .select({ uuid: users.uuid })
      .from(users)
      .where(eq(users.full_name, data.author.full_name))
      .limit(1);
  }
  if (!author) {
    const uuid = randomUUID();
    await db.insert(users).values({ uuid, ...data.author });
    author = { uuid };
  }

  // --- Le challenge source ---
  let [codeChallenge] = await db
    .select({ uuid: challenges.uuid })
    .from(challenges)
    .where(eq(challenges.title, data.code_challenge.title))
    .limit(1);
  if (!codeChallenge) {
    const uuid = randomUUID();
    await db.insert(challenges).values({
      uuid,
      ...data.code_challenge,
      slug: await freeChallengeSlug(data.code_challenge.title),
      project_id: project.uuid,
    });
    codeChallenge = { uuid };
  }

  // --- Le livrable évalué, et donc ce qu'un validateur va parcourir ---
  let [contribution] = await db
    .select({ uuid: contributions.uuid })
    .from(contributions)
    .where(
      and(
        eq(contributions.challenge_id, codeChallenge.uuid),
        eq(contributions.user_id, author.uuid),
        eq(contributions.type, "project")
      )
    )
    .limit(1);

  if (contribution) {
    // Un redéploiement change l'URL que charge l'iframe : on la remet à jour
    // même quand la contribution existait déjà.
    await db
      .update(contributions)
      .set({ live_endpoint_url: data.deployed_url, artifact_url: data.repo_url })
      .where(eq(contributions.uuid, contribution.uuid));
  } else {
    const uuid = randomUUID();
    await db.insert(contributions).values({
      uuid,
      ...data.contribution,
      user_id: author.uuid,
      challenge_id: codeChallenge.uuid,
      artifact_url: data.repo_url,
      live_endpoint_url: data.deployed_url,
    });
    contribution = { uuid };
  }

  // --- L'auteur dans l'équipe du challenge source ---
  // Sans cette ligne il a une contribution sur un challenge dont il n'est pas
  // membre : la page du challenge ne le montrerait pas.
  const [membership] = await db
    .select({ challenge_id: challenge_teams.challenge_id })
    .from(challenge_teams)
    .where(
      and(
        eq(challenge_teams.challenge_id, codeChallenge.uuid),
        eq(challenge_teams.user_id, author.uuid)
      )
    )
    .limit(1);
  if (!membership) {
    await db.insert(challenge_teams).values({
      challenge_id: codeChallenge.uuid,
      user_id: author.uuid,
    });
  }

  // --- Le challenge de validation ---
  let [validation] = await db
    .select({ uuid: challenges.uuid })
    .from(challenges)
    .where(eq(challenges.title, data.validation_challenge.title))
    .limit(1);
  if (!validation) {
    const uuid = randomUUID();
    await db.insert(challenges).values({
      uuid,
      ...data.validation_challenge,
      slug: await freeChallengeSlug(data.validation_challenge.title),
      project_id: project.uuid,
      source_challenge_id: codeChallenge.uuid,
    });
    validation = { uuid };
  }

  // --- La cible exposée ---
  const [target] = await db
    .select({ uuid: validation_targets.uuid })
    .from(validation_targets)
    .where(
      and(
        eq(validation_targets.validation_challenge_id, validation.uuid),
        eq(validation_targets.contribution_id, contribution.uuid)
      )
    )
    .limit(1);
  if (!target) {
    await db.insert(validation_targets).values({
      uuid: randomUUID(),
      validation_challenge_id: validation.uuid,
      contribution_id: contribution.uuid,
      position: 0,
    });
  }

  // --- Le scénario ---
  // Inséré seulement s'il est vide : le service gèle le scénario dès la
  // première walkthrough, et y ajouter des étapes après coup rendrait les
  // parcours incomparables.
  const steps = await db
    .select({ uuid: validation_scenario_steps.uuid })
    .from(validation_scenario_steps)
    .where(eq(validation_scenario_steps.validation_challenge_id, validation.uuid));

  if (steps.length === 0) {
    await db.insert(validation_scenario_steps).values(
      data.scenario_steps.map((step: any, index: number) => ({
        uuid: randomUUID(),
        validation_challenge_id: validation.uuid,
        position: index,
        title: step.title,
        instructions: step.instructions,
      }))
    );
  }

  console.log(
    `✓ MyKine validation: challenge « ${data.validation_challenge.title} », ` +
      `${steps.length === 0 ? data.scenario_steps.length : steps.length} scenario steps`
  );
}

// ---------------------------------------------------------------------------
// Étage 3 — les propositions de démonstration du Sandbox (`--demo`)
// ---------------------------------------------------------------------------

/** Paliers de démonstration. Inertes par défaut en base — sans eux, starer ne paie rien. */
const STAR_TIERS = [
  { stars: 5, cp: 50 },
  { stars: 15, cp: 100 },
  { stars: 30, cp: 250 },
];
const PROMOTION_BONUS_CP = 200;

/**
 * Hachés d'IP fabriqués, pour que le panneau d'audit admin ait de quoi
 * grouper. Six adresses en rotation : le plafond anti-abus est de 30 stars
 * anonymes par heure et par haché, aucune ne s'en approche.
 */
const DEMO_IP_HASHES = Array.from({ length: 6 }, (_, i) =>
  hashIp(`203.0.113.${10 + i}`, "sandbox-demo-seed")
);

/**
 * Les propositions de démonstration, leurs stars et les CP qu'elles paient.
 *
 * Tout passe par les **vrais services** plutôt que par des INSERT :
 * `SandboxService.star()` paie les paliers franchis, `promote()` ouvre la
 * vraie transaction de promotion. L'état produit est donc exactement celui
 * qu'aurait produit l'usage réel — compteurs, seuils payés et ledger
 * cohérents entre eux.
 *
 * La seule écriture directe : `created_at` / `updated_at`, antidatés après
 * coup. Le repository ne les accepte pas à la création, et sans ça les cinq
 * propositions arriveraient à la même seconde — le tri par récence du listing
 * n'aurait rien à montrer.
 */
async function seedDemoSandboxes() {
  const data = read<any[]>("demo-sandboxes.json");

  const appSettingsRepo = new AppSettingsRepository();
  const projectRepo = new ProjectRepository();
  const sandboxRepo = new SandboxRepository();
  const sandboxService = new SandboxService();
  const promotionService = new SandboxPromotionService();

  const allUsers = await db.select({ uuid: users.uuid, full_name: users.full_name }).from(users);
  if (allUsers.length < 4) {
    console.log("⚠️  Demo sandboxes skipped: not enough users in DB");
    return;
  }
  const userByName = new Map(allUsers.map((u) => [u.full_name, u.uuid]));
  const allUserIds = allUsers.map((u) => u.uuid);

  // --- Réglages de l'économie ---
  // Écrits seulement si l'admin n'a rien configuré : ce seed ne doit pas
  // écraser des paliers réglés à la main sur une base de travail.
  const settings = await appSettingsRepo.get();
  if ((settings.sandbox_star_tiers ?? []).length === 0) {
    await appSettingsRepo.update({
      sandbox_star_tiers: STAR_TIERS,
      sandbox_promotion_bonus_cp: PROMOTION_BONUS_CP,
    });
    console.log(
      `  ✓ Star tiers: ${STAR_TIERS.map((t) => `${t.stars}* -> ${t.cp} CP`).join(", ")} ` +
        `· promotion +${PROMOTION_BONUS_CP} CP`
    );
  } else {
    console.log(`  = Star tiers already configured (${settings.sandbox_star_tiers.length}) — left as is`);
  }

  /**
   * Le projet qui accueille les challenges issus d'une promotion.
   *
   * Créé à la demande, et non d'office : aucune proposition de démonstration
   * n'est promue aujourd'hui, et un projet vide de plus sur la page d'accueil
   * n'aurait rien à montrer. Il suffit d'ajouter un bloc `promote` dans
   * `demo-sandboxes.json` pour que ce chemin reprenne.
   */
  const HOST_PROJECT_TITLE = "MyTwin — Jumeau numérique du corps";
  let hostProjectId: string | null = null;
  async function hostProject(): Promise<string> {
    if (hostProjectId) return hostProjectId;
    const [existing] = await db
      .select({ uuid: projects.uuid })
      .from(projects)
      .where(eq(projects.title, HOST_PROJECT_TITLE))
      .limit(1);
    hostProjectId =
      existing?.uuid ??
      (
        await projectRepo.create({
          title: HOST_PROJECT_TITLE,
          description: "Projet d'accueil des challenges issus de propositions du Sandbox.",
        })
      ).uuid;
    return hostProjectId;
  }

  for (const [index, entry] of data.entries()) {
    const authorId = userByName.get(entry.author_full_name) ?? allUserIds[index % allUserIds.length];

    // Reconnue à (auteur, titre) : rejouer le seed ne crée pas de doublon.
    const [existing] = await db
      .select({ uuid: sandboxes.uuid })
      .from(sandboxes)
      .where(and(eq(sandboxes.user_id, authorId), eq(sandboxes.title, entry.title)))
      .limit(1);

    let sandboxId: string;
    if (existing) {
      sandboxId = existing.uuid;
      console.log(`  = « ${entry.title} » already present`);
    } else {
      const created = await sandboxService.create({
        user_id: authorId,
        title: entry.title,
        context: entry.context,
        goals: entry.goals,
        why: entry.why,
      });
      sandboxId = created.uuid;

      const createdAt = daysAgo(entry.created_days_ago);
      await db
        .update(sandboxes)
        .set({ created_at: createdAt, updated_at: createdAt })
        .where(eq(sandboxes.uuid, sandboxId));

      // L'auteur est écarté : il ne peut pas starer sa propre proposition.
      const voters = allUserIds.filter((id) => id !== authorId).slice(0, entry.stars.account);
      for (const [i, userId] of voters.entries()) {
        await sandboxService.star(
          sandboxId,
          { kind: "account", userId },
          DEMO_IP_HASHES[i % DEMO_IP_HASHES.length]
        );
      }
      for (let i = 0; i < entry.stars.anonymous; i++) {
        await sandboxService.star(
          sandboxId,
          { kind: "anonymous", anonId: `${entry.stars.prefix}-${String(i + 1).padStart(3, "0")}` },
          DEMO_IP_HASHES[i % DEMO_IP_HASHES.length]
        );
      }

      const total = entry.stars.account + entry.stars.anonymous;
      console.log(`  + « ${entry.title} » + ${total} stars`);

      // Archiver après avoir staré : une proposition qui n'est plus `open`
      // refuse toute nouvelle star. Le palier franchi reste payé.
      if (entry.archive) {
        await sandboxService.archive(sandboxId, { userId: authorId, isAdmin: false });
      }
    }

    // --- Promotion, via le vrai service ---
    if (entry.promote) {
      const row = await sandboxRepo.findById(sandboxId);
      if (row?.status === "open") {
        const p = entry.promote;
        const { challenge } = await promotionService.promote({
          sandboxId,
          // L'acteur n'est pas persisté : le service ne s'en sert que pour
          // vérifier le rôle. Un admin de façade suffit donc à un seed.
          actor: { userId: authorId, role: "admin" },
          input: {
            status: p.status,
            // Le type est choisi ici, par l'admin : une proposition n'en porte pas.
            type: p.type,
            start_date: daysAgo(p.start_days_ago).toISOString().split("T")[0],
            end_date: daysAgo(p.end_days_ago).toISOString().split("T")[0],
            contribution_points_reward: p.contribution_points_reward,
            project_id: await hostProject(),
            compute_enabled: p.compute_enabled,
            api_packaging_enabled: p.api_packaging_enabled,
          },
        });
        await db
          .update(sandboxes)
          .set({ promoted_at: daysAgo(p.promoted_days_ago), updated_at: daysAgo(p.promoted_days_ago) })
          .where(eq(sandboxes.uuid, sandboxId));
        console.log(`  → promoted to challenge ${challenge.uuid}`);
      }
    }
  }

  // Les hôtes de démonstration : `db_data/hosts.json` cite des établissements
  // réels en exemple, et écrire le nom d'un CHU sur la page publique d'un
  // challenge qu'il n'héberge pas est une affiliation inventée, pas une donnée
  // de test. En production, l'hôte se saisit dans le tiroir d'administration.
  await logHosts();
}

// ---------------------------------------------------------------------------
// Reset (`--force`)
// ---------------------------------------------------------------------------

/**
 * Vide tout ce que ce seed sait poser, dans l'ordre inverse des dépendances.
 *
 * Plusieurs de ces tables cascadent déjà depuis `users` ou `challenges`, mais
 * elles sont vidées explicitement pour que le log dise ce qui a été détruit :
 * un sandbox et ses CP ne doivent pas disparaître silencieusement.
 */
async function resetAll() {
  console.log("⚠️  --force: resetting ALL data (including OAuth users)...\n");

  const steps: Array<[string, () => Promise<unknown>]> = [
    ["validation_scenario_steps", () => db.delete(validation_scenario_steps)],
    ["validation_targets", () => db.delete(validation_targets)],
    ["evaluation_grid_subcriteria", () => db.delete(evaluation_grid_subcriteria)],
    ["evaluation_grid_categories", () => db.delete(evaluation_grid_categories)],
    ["evaluation_grids", () => db.delete(evaluation_grids)],
    ["challenge_signals", () => db.delete(challenge_signals)],
    ["challenge_teams", () => db.delete(challenge_teams)],
    ["challenge_repos", () => db.delete(challenge_repos)],
    ["reward_entries", () => db.delete(reward_entries)],
    ["contributions", () => db.delete(contributions)],
    ["sandbox_rewards", () => db.delete(sandbox_rewards)],
    ["sandbox_stars", () => db.delete(sandbox_stars)],
    ["sandboxes", () => db.delete(sandboxes)],
    ["challenges", () => db.delete(challenges)],
    ["repos", () => db.delete(repos)],
    ["onboarding_progress", () => db.delete(onboarding_progress)],
    ["users", () => db.delete(users)],
    ["projects", () => db.delete(projects)],
  ];

  for (const [name, run] of steps) {
    await run();
    console.log(`  ✓ ${name} cleared`);
  }

  console.log("✅ Database reset complete!\n");
}

// ---------------------------------------------------------------------------

async function main() {
  if (flags.force) await resetAll();

  console.log("🌱 Seed — production data" + (flags.demo ? " + demo sandboxes" : "") + "\n");

  await seedProjects();
  await seedUsers();
  await seedRepos();
  await seedChallenges();
  await seedChallengeRepos();
  await seedChallengeTeams();
  await seedContributions();
  await seedRewardEntries();
  await seedChallengeSignals();
  await seedOnboarding();
  await seedSandboxes();
  await seedEvaluationGrids();
  await seedMyKineValidation();

  // En dernier : les briefs se retrouvent par le slug de leur challenge, qui
  // vient d'être posé au-dessus pour ceux que ce seed a créés.
  await logBriefs();

  if (flags.demo) {
    console.log("\n🎭 Demo sandboxes — stars and tiers (pays CP)\n");
    await seedDemoSandboxes();
  } else {
    console.log("\n  (demo sandboxes skipped — pass --demo to seed them)");
  }

  console.log("\n✅ Seed terminé avec succès !");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
