/**
 * Le slug d'un challenge ou d'un sandbox : le segment lisible de son URL
 * publique (`/challenges/<slug>`, `/sandbox/<slug>`).
 *
 * Module pur, sans base ni dépendance : les repositories, le backfill de
 * `scripts/db-apply-schema.ts`, les schémas Zod et les formulaires client
 * l'importent tous. Une seule définition, pour que la prod reçoive au
 * déploiement exactement le slug que l'interface aurait proposé.
 *
 * À ne pas confondre avec `packages/provisioner/src/utils.ts#slugify`, qui
 * nomme les branches Git des challenges : ses règles sont différentes (il
 * garde `_`), et les aligner changerait le nom des branches à venir.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 80;

/**
 * Mots refusés comme slug, pour laisser la place à de futures routes
 * statiques sous `/challenges/` et `/sandbox/` sans collision avec un contenu.
 */
export const RESERVED_SLUGS: readonly string[] = ["new", "edit"];

/** Le repli d'un titre qui ne donne aucun caractère exploitable. */
export const SLUG_FALLBACK = { challenge: "challenge", sandbox: "sandbox" } as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lettres que NFKD ne décompose pas, et qui disparaîtraient sinon :
 * « cœur » donnerait `c-ur`.
 */
const TRANSLITERATIONS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
};

/**
 * Un UUID satisfait le motif d'un slug. Un slug en forme d'UUID rendrait
 * ambiguë la redirection des anciennes URLs `/challenges/<uuid>` : il est
 * refusé.
 */
export function looksLikeUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Minuscules, sans diacritiques, lettres non décomposables translittérées. */
function foldLetters(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ßæœøđðłþ]/g, (letter) => TRANSLITERATIONS[letter] ?? letter);
}

/**
 * Pourquoi `value` n'est pas un slug acceptable, en une phrase affichable —
 * `null` s'il l'est. Partagé par l'API et les formulaires, pour que le
 * message soit le même des deux côtés.
 */
export function slugProblem(value: string): string | null {
  if (!value) return "Choose an address.";
  if (value.length < SLUG_MIN_LENGTH) return `At least ${SLUG_MIN_LENGTH} characters.`;
  if (value.length > SLUG_MAX_LENGTH) return `At most ${SLUG_MAX_LENGTH} characters.`;
  if (!SLUG_PATTERN.test(value)) return "Lowercase letters, digits and single hyphens only.";
  if (looksLikeUuid(value)) return "It can't look like an id.";
  if (RESERVED_SLUGS.includes(value)) return "This word is reserved.";
  return null;
}

export function isValidSlug(value: string): boolean {
  return slugProblem(value) === null;
}

/** Coupe à `max` sur une frontière de mot quand c'est possible. */
function truncateSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  // Coupé pile avant un tiret : le dernier mot est entier.
  if (slug[max] === "-") return cut.replace(/-+$/, "");
  const lastHyphen = cut.lastIndexOf("-");
  // Un seul mot très long : couper au milieu vaut mieux que ne rien garder.
  return (lastHyphen >= SLUG_MIN_LENGTH ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
}

/**
 * Le slug proposé pour un titre. Toujours valide : un titre trop court, vide,
 * réservé ou en forme d'UUID est complété par `fallback`.
 */
export function slugify(title: string, fallback: string): string {
  const base = truncateSlug(
    foldLetters(title)
      .replace(/&/g, " and ")
      // `patient's` → `patients`, pas `patient-s`.
      .replace(/['’‘`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    SLUG_MAX_LENGTH,
  );

  if (!base) return fallback;
  if (isValidSlug(base)) return base;
  return truncateSlug(`${base}-${fallback}`, SLUG_MAX_LENGTH);
}

/**
 * Normalise ce que l'utilisateur tape dans le champ slug, à chaque frappe.
 * Tant que `final` est faux, un tiret final est gardé : sans lui, taper
 * `mammography-` effacerait le tiret avant qu'on ait pu écrire la suite.
 */
export function normalizeSlugInput(raw: string, { final = false }: { final?: boolean } = {}): string {
  const normalized = foldLetters(raw)
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX_LENGTH);
  return final ? normalized.replace(/-+$/, "") : normalized;
}

/**
 * Le n-ième candidat pour une base : `base`, puis `base-2`, `base-3`… La base
 * est raccourcie quand le suffixe ferait dépasser la longueur maximale.
 */
export function slugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  const room = SLUG_MAX_LENGTH - suffix.length;
  const trimmed = base.length > room ? base.slice(0, room).replace(/-+$/, "") : base;
  return `${trimmed}${suffix}`;
}

/** Premier candidat libre, pour un appelant qui connaît déjà tous les slugs pris. */
export function firstFreeSlug(base: string, isTaken: (slug: string) => boolean): string {
  for (let attempt = 1; ; attempt++) {
    const candidate = slugCandidate(base, attempt);
    if (!isTaken(candidate)) return candidate;
  }
}

/** Le slug demandé est déjà porté, ou redirige vers une autre ligne. */
export class SlugTakenError extends Error {
  constructor(
    readonly slug: string,
    /** Le premier candidat libre dérivé du slug demandé. */
    readonly suggestion: string,
  ) {
    super(`The address "${slug}" is already taken.`);
    this.name = "SlugTakenError";
  }
}

export interface SlugBackfillRow {
  uuid: string;
  title: string;
  slug: string | null;
}

/**
 * Les slugs à écrire pour les lignes qui n'en ont pas encore.
 *
 * `rows` doit arriver dans un ordre stable (`created_at`, puis `uuid`) : à
 * titres égaux, le plus ancien garde le slug nu et le suivant prend `-2`, et
 * rejouer le backfill sur les mêmes données donne le même résultat.
 *
 * Les slugs déjà posés sont réservés d'emblée, ainsi que `alsoTaken` (les
 * anciens slugs gardés en redirection) : une ligne créée entre deux
 * déploiements garde le sien, et aucune redirection n'est détournée.
 */
export function planSlugBackfill(
  rows: readonly SlugBackfillRow[],
  fallback: string,
  alsoTaken: Iterable<string> = [],
): Array<{ uuid: string; slug: string }> {
  const taken = new Set<string>(alsoTaken);
  for (const row of rows) if (row.slug) taken.add(row.slug);

  const assignments: Array<{ uuid: string; slug: string }> = [];
  for (const row of rows) {
    if (row.slug) continue;
    const slug = firstFreeSlug(slugify(row.title, fallback), (candidate) => taken.has(candidate));
    taken.add(slug);
    assignments.push({ uuid: row.uuid, slug });
  }
  return assignments;
}
