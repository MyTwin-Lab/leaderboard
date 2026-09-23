/**
 * Régénère les données du seed (`db_data/*.json` et `db_data/briefs/*.md`) à
 * partir d'un dump `pg_dump` de la production.
 *
 * Le seed n'est pas écrit à la main : il est *dérivé* de la prod, et ce script
 * est le seul chemin. Rejouer un refresh consiste à reprendre un dump et à
 * relancer ceci — voir `db_data/README.md`.
 *
 *   node scripts/dump-to-seed-data.mjs <dump.sql>
 *
 * Ce qui n'est jamais repris, et pourquoi :
 *   - `refresh_tokens`      sessions vivantes, sans valeur hors de la prod
 *   - `app_settings`        jetons chiffrés (Slack, GitHub, OpenAI, Scaleway)
 *   - `users.email`,        données de compte OAuth : elles se reconstruisent
 *     `.google_user_id`,    à la première connexion, et n'ont rien à faire
 *     `.avatar_url`         dans un dépôt public
 *   - `challenge_slack_configs`  pointe un vrai canal Slack de l'équipe
 *
 * Ce qui est traduit vers le schéma courant, en avance sur la prod :
 *   - `sandboxes`  perd type/repo_url/model_url/dataset_urls/evaluation* —
 *     colonnes supprimées par la migration 0025 (« un sandbox est un projet »)
 *   - `challenges` gagne cover_image_url/host : `host` reste NULL, et
 *     cover_image_url est repris de COVER_IMAGES plus bas — un slug absent de
 *     cette table retombe sur la banque d'images de la landing
 *     (lib/coverImage.ts)
 */
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {createHash} from 'crypto';
import {join} from 'path';

/**
 * Un uuid v5 déterministe, pour les lignes que ce script fabrique.
 *
 * Déterministe et non aléatoire : le seed déduplique sur l'uuid, donc
 * régénérer les données depuis un dump plus récent doit rendre le même
 * identifiant pour la même ligne, sinon chaque refresh la dupliquerait.
 */
const UUID_NS = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
function uuidv5(name) {
  const ns = Buffer.from(UUID_NS.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = h.subarray(0, 16).toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const DUMP = process.argv[2];
if (!DUMP) {
  console.error('usage: node scripts/dump-to-seed-data.mjs <dump.sql>');
  process.exit(1);
}

const OUT_DIR = 'db_data';
const BRIEFS_DIR = join(OUT_DIR, 'briefs');

// ---------------------------------------------------------------------------
// 1. Types des colonnes, lus dans le schéma Drizzle
// ---------------------------------------------------------------------------
// Le dump COPY ne transporte que du texte : 't', '5', '[]' y sont
// indistinguables d'une chaîne. Le schéma dit lesquelles sont des booléens,
// des nombres ou du JSON — sans lui, le seed réinsérerait des chaînes.

function readSchemaTypes() {
  const src = readFileSync('packages/database-service/db/drizzle.ts', 'utf8');
  const types = new Map(); // table -> Map(colonne SQL -> type drizzle)
  const re = /export const (\w+) = pgTable\(\s*["'](\w+)["']\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const start = re.lastIndex;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const cols = new Map();
    let d = 0;
    for (const line of src.slice(start, i - 1).split('\n')) {
      if (d === 0) {
        const c = /^\s*["']?([a-zA-Z_]\w*)["']?\s*:\s*(\w+)\(\s*(?:["']([^"']+)["'])?/.exec(line);
        if (c) cols.set(c[3] || c[1], c[2]);
      }
      for (const ch of line) { if ('{(['.includes(ch)) d++; else if ('})]'.includes(ch)) d--; }
    }
    types.set(m[2], cols);
  }
  return types;
}

// ---------------------------------------------------------------------------
// 2. Lecture du dump
// ---------------------------------------------------------------------------

function parseDump(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const tables = new Map();
  let i = 0;
  while (i < lines.length) {
    const m = /^COPY public\.(\S+) \((.*)\) FROM stdin;/.exec(lines[i]);
    if (m) {
      const name = m[1].replace(/"/g, '');
      const cols = m[2].split(', ').map(c => c.replace(/"/g, ''));
      const rows = [];
      i++;
      while (i < lines.length && lines[i] !== '\\.') {
        rows.push(lines[i].split('\t').map(v => (v === '\\N' ? null : unescapeCopy(v))));
        i++;
      }
      tables.set(name, {cols, rows});
    }
    i++;
  }
  return tables;
}

function unescapeCopy(v) {
  return v.replace(/\\(.)/g, (_, c) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c);
}

// ---------------------------------------------------------------------------
// 3. Conversion d'une table en objets typés
// ---------------------------------------------------------------------------

const NUMERIC = new Set(['integer', 'real', 'serial', 'doublePrecision']);

function rowsOf(dump, schema, table, {only, drop} = {}) {
  const t = dump.get(table);
  if (!t) throw new Error(`table absente du dump : ${table}`);
  const colTypes = schema.get(table) ?? new Map();

  return t.rows.map(r => {
    const o = {};
    t.cols.forEach((col, i) => {
      if (only && !only.includes(col)) return;
      if (drop && drop.includes(col)) return;
      o[col] = coerce(r[i], colTypes.get(col));
    });
    return o;
  });
}

function coerce(v, type) {
  if (v === null) return null;
  if (type === 'boolean') return v === 't';
  if (NUMERIC.has(type)) return v === '' ? null : Number(v);
  if (type === 'json' || type === 'jsonb') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

// ---------------------------------------------------------------------------
// 4. Écriture
// ---------------------------------------------------------------------------

function write(name, data) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  ${String(n).padStart(4)} → ${name}`);
}

const schema = readSchemaTypes();
const dump = parseDump(DUMP);

console.log(`Dump : ${DUMP}\n`);

// --- Tables reprises telles quelles ---
write('projects.json', rowsOf(dump, schema, 'projects'));

// Identités : on garde ce qui fait une personne dans le classement, pas son
// compte. email / google_user_id / avatar_url sont reconstruits au login.
write('users.json', rowsOf(dump, schema, 'users', {
  drop: ['email', 'google_user_id', 'avatar_url'],
}));

// `index` n'est pas repris : c'est un serial, et la prod en a 4 doublons
// (5, 6, 7, 8 deux fois). Le seed laisse Postgres l'attribuer.
//
// `TYPE_OVERRIDES` corrige le type porté par la prod, par slug. Ces deux
// challenges y sont marqués `code` alors qu'aucun livrable n'est du code :
// l'override est appliqué ici, et non à la main dans le JSON, pour qu'un
// refresh depuis un dump plus récent ne le reperde pas.
const TYPE_OVERRIDES = {
  'lab-community-management': 'none',
  'mytwin-3d-gtm': 'none',
  // Marqué `code` en production, mais tout le reste de sa ligne dit `ml` : il
  // porte des `reward_rules` au schéma ML (dataset / model / apiPackaging /
  // reuse, métrique `auc`) et son ledger n'utilise que des clés ML —
  // `model_metric`, `beat_best`, `dataset`. C'est la colonne `type` qui est
  // fausse, pas le reste.
  'mammography-classification': 'ml',
};

// La production archive ses challenges terminés ; le seed les présente comme
// `completed`. Archiver retire d'un listing, ça ne décrit pas l'état du
// travail — or celui-ci est bel et bien fini, et sa completion le dit. Rien
// n'empêche d'archiver à nouveau dans l'application.
//
// `closed_at` reste nul : la production ne le porte sur aucun d'eux, et il
// n'existe aucune date de fermeture à reconstituer — la plupart n'ont même pas
// d'`end_date`. Inventer une date fausserait le digest, qui lit cette colonne.
const STATUS_OVERRIDES = {
  archived: 'completed',
};

// Les couvertures, par slug. Elles ne viennent pas du dump — la production n'a
// pas encore la colonne `cover_image_url` — mais du travail de cadrage fait
// dans l'application, qu'on fige ici pour que le seed le repose.
//
// Deux formes. Une URL externe se suffit à elle-même. Une image déposée vit en
// `bytea` dans la table `images` et s'adresse en `/api/images/<uuid>` : ses
// octets sont dans `db_data/images/`, son manifeste dans `db_data/images.json`,
// et `seedImages()` repose la ligne avant que les challenges ne la citent.
// Regénérer ce fichier ne les reconstitue pas — `scripts/dump-to-seed-data.mjs`
// ne lit qu'un dump SQL, pas des `bytea` — ils sont exportés à part depuis la
// base, une fois, et suivis dans le dépôt.
//
// Un slug absent d'ici garde `null` et retombe sur la banque d'images de la
// landing (`lib/coverImage.ts`), ce qui reste un rendu correct.
const COVER_IMAGES = {
  'mammography': 'https://www.cdc.gov/breast-cancer/media/images/mammogram-b1200x675.jpg',
  'mammography-classification': 'https://www.cdc.gov/breast-cancer/media/images/mammogram-b1200x675.jpg',
  'mammography-segmentation': 'https://www.cdc.gov/breast-cancer/media/images/mammogram-b1200x675.jpg',
  'poc-injury-prediction-in-tennis':
    'https://www.docdusport.com/wp-content/uploads/2021/12/Tennis-sante-conseils-et-bonne-pratique-1024x681.jpg',
  'contributor-experience-update': '/api/images/9ecf1d01-1238-4fe1-80d4-691a89778192',
};

const challengeRows = rowsOf(dump, schema, 'challenges', {drop: ['index']});
for (const c of challengeRows) {
  if (c.slug in TYPE_OVERRIDES) c.type = TYPE_OVERRIDES[c.slug];
  if (c.status in STATUS_OVERRIDES) c.status = STATUS_OVERRIDES[c.status];
  c.cover_image_url = COVER_IMAGES[c.slug] ?? null;
}
// Écrit plus bas : `completion` est recalculée une fois le ledger complété.

write('repos.json', rowsOf(dump, schema, 'repos'));
write('challenge-repos.json', rowsOf(dump, schema, 'challenge_repos'));
let teamRows = rowsOf(dump, schema, 'challenge_teams');
// Écrit plus bas : complété par les auteurs de contributions qui n'y sont pas.
const contributionRows = rowsOf(dump, schema, 'contributions');
const rewardRows = rowsOf(dump, schema, 'reward_entries');

// --- Rattrapage du ledger -------------------------------------------------
//
// `challenges.completion` se calcule sur `reward_entries`, pas sur
// `contributions.reward` (cf. scripts/db-resync-rewards.ts). Or les dix
// challenges archivés de la production sont antérieurs au ledger : leurs CP
// ne vivent que dans `contributions.reward`, la somme de leurs écritures vaut
// zéro, et ils s'affichent donc tous à 0 % bien qu'ils aient distribué de
// 3 200 à 12 000 CP.
//
// On écrit ici l'écriture manquante — une par contribution rémunérée qui n'en
// a aucune. `rule_key` doit rester dans l'enum fermé de
// `domain/schemas_zod.ts` : `code_fixed`, la part fixe de livraison, est la
// seule qui décrive un versement de challenge `code`. Elle a un second effet
// utile : `CodeRewardsService` lit `alreadyAwarded.code_fixed`, donc une
// ré-évaluation ne repaiera pas ce qui l'a déjà été.
//
// `meta.backfilled` garde la provenance : ces lignes n'ont pas été produites
// par le moteur de règles, elles reconstituent un versement déjà fait.

const withLedger = new Set(rewardRows.map(r => r.contribution_id).filter(Boolean));
let backfilled = 0;
for (const c of contributionRows) {
  if (!c.reward || withLedger.has(c.uuid)) continue;
  rewardRows.push({
    uuid: uuidv5(`reward-backfill:${c.uuid}`),
    challenge_id: c.challenge_id,
    user_id: c.user_id,
    contribution_id: c.uuid,
    rule_key: 'code_fixed',
    points: c.reward,
    source_user_id: null,
    meta: { backfilled: true, source: 'contributions.reward' },
    created_at: c.submitted_at ?? c.created_at,
  });
  backfilled++;
}

// `completion` recalculée sur le ledger ainsi complété, avec la formule de
// db-resync-rewards : min(1, distribué / pool), hors signaux Slack.
const distributed = new Map();
for (const r of rewardRows) {
  if (r.rule_key === 'slack_signal') continue;
  distributed.set(r.challenge_id, (distributed.get(r.challenge_id) ?? 0) + r.points);
}
let recomputed = 0;
for (const c of challengeRows) {
  const pool = c.contribution_points_reward ?? 0;
  const next = pool > 0 ? Math.min(1, (distributed.get(c.uuid) ?? 0) / pool) : 0;
  if (Math.abs((c.completion ?? 0) - next) > 1e-6) recomputed++;
  c.completion = next;
}

// --- Rattrapage des équipes ----------------------------------------------
//
// Avoir contribué à un challenge sans figurer dans son équipe n'a pas de sens
// : c'est l'appartenance qui fait apparaître la personne sur la page du
// challenge, et la production compte dix paires (auteur, challenge) dans ce
// cas — des contributions antérieures au provisionnement des workspaces.
//
// Les colonnes de workspace restent nulles, et c'est volontaire : ces
// contributeurs n'ont jamais eu de branche provisionnée. Inventer une
// `workspace_ref` ferait croire à un espace de travail qui n'existe pas.

const inTeam = new Set(teamRows.map(t => `${t.challenge_id}|${t.user_id}`));
let joined = 0;
for (const c of contributionRows) {
  const key = `${c.challenge_id}|${c.user_id}`;
  if (!c.user_id || !c.challenge_id || inTeam.has(key)) continue;
  inTeam.add(key);
  teamRows.push({
    challenge_id: c.challenge_id,
    user_id: c.user_id,
    workspace_provider: null,
    workspace_ref: null,
    workspace_url: null,
    workspace_status: null,
    group_id: null,
  });
  joined++;
}

// --- Participations retirées ---------------------------------------------
//
// Une appartenance que la production porte mais qui ne décrit rien : aucune
// contribution derrière, et la personne n'a pas travaillé sur ce challenge.
// Retirée par (slug, compte GitHub) plutôt qu'à la main dans le JSON, pour
// qu'un refresh depuis un dump plus récent ne la reprenne pas.
const TEAM_EXCLUSIONS = [
  ['mytwin-3d-gtm', 'akralan'],
  ['lab-community-management', 'akralan'],
];

const userIdByGithub = new Map(
  rowsOf(dump, schema, 'users')
    .filter(u => u.github_username)
    .map(u => [u.github_username, u.uuid])
);
const challengeIdBySlug = new Map(challengeRows.map(c => [c.slug, c.uuid]));

const excluded = new Set(
  TEAM_EXCLUSIONS.map(([slug, handle]) =>
    `${challengeIdBySlug.get(slug)}|${userIdByGithub.get(handle)}`)
);
const beforeExclusion = teamRows.length;
teamRows = teamRows.filter(t => !excluded.has(`${t.challenge_id}|${t.user_id}`));
const removed = beforeExclusion - teamRows.length;

write('challenges.json', challengeRows);
write('challenge-teams.json', teamRows);
write('contributions.json', contributionRows);
write('reward-entries.json', rewardRows);
console.log(
  `       ↳ ${backfilled} écritures de ledger, ${recomputed} completions recalculées, ` +
    `${joined} participations rattrapées, ${removed} retirées`
);
write('challenge-signals.json', rowsOf(dump, schema, 'challenge_signals'));
write('onboarding-progress.json', rowsOf(dump, schema, 'onboarding_progress'));

// Un sandbox est un projet : la migration 0025 lui a retiré tout ce qui
// décrivait un livrable. Les colonnes existent encore en prod, on les laisse.
write('sandboxes.json', rowsOf(dump, schema, 'sandboxes', {
  drop: ['type', 'repo_url', 'model_url', 'dataset_urls',
         'evaluation', 'evaluation_status', 'evaluated_at'],
}));

// --- Grilles d'évaluation : imbriquées, pour rester lisibles à la main ---
const grids = rowsOf(dump, schema, 'evaluation_grids');
const cats = rowsOf(dump, schema, 'evaluation_grid_categories');
const subs = rowsOf(dump, schema, 'evaluation_grid_subcriteria');
write('evaluation-grids.json', grids.map(g => ({
  ...g,
  categories: cats
    .filter(c => c.grid_id === g.id)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      ...c,
      subcriteria: subs
        .filter(s => s.category_id === c.id)
        .sort((a, b) => a.position - b.position),
    })),
})));

// --- Briefs : un .md par slug, comme challenge-content.ts les attend ---
mkdirSync(BRIEFS_DIR, {recursive: true});
const ch = dump.get('challenges');
const slugOf = new Map(ch.rows.map(r =>
  [r[ch.cols.indexOf('uuid')], r[ch.cols.indexOf('slug')]]));
let briefs = 0;
for (const d of rowsOf(dump, schema, 'challenge_documents')) {
  if (d.filename !== 'brief.md') continue;
  const slug = slugOf.get(d.challenge_id);
  if (!slug) continue;
  writeFileSync(join(BRIEFS_DIR, `${slug}.md`), d.content, 'utf8');
  briefs++;
}
console.log(`  ${String(briefs).padStart(4)} → briefs/*.md`);

console.log('\nOK.');
