import { SlugTakenError, slugCandidate, slugify } from "../domain/slug";

/** Code d'unicité que Postgres lève quand deux écritures visent le même slug. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Ce qu'un repository sait lire de ses slugs, pour une table donnée : la ligne
 * qui porte un slug comme slug courant, et celle vers laquelle un ancien slug
 * redirige. Challenges et sandboxes ont chacun leur espace de noms, donc
 * chacun son implémentation — la règle, elle, est ici, une seule fois.
 */
export interface SlugOwners {
  currentOwner(slug: string): Promise<string | null>;
  redirectOwner(slug: string): Promise<string | null>;
}

/**
 * Un slug est pris s'il est le slug courant d'une autre ligne, **ou** s'il
 * redirige vers une autre ligne : le rendre à quelqu'un d'autre détournerait
 * les liens partagés sous cet ancien slug. `exceptId` est la ligne qu'on
 * édite — son propre slug, et ses propres anciens slugs, restent à elle.
 */
export async function isSlugTaken(owners: SlugOwners, slug: string, exceptId?: string): Promise<boolean> {
  const [current, redirect] = await Promise.all([owners.currentOwner(slug), owners.redirectOwner(slug)]);
  return (current !== null && current !== exceptId) || (redirect !== null && redirect !== exceptId);
}

/** Premier candidat libre dérivé de `base` : `base`, `base-2`, `base-3`… */
export async function availableSlug(owners: SlugOwners, base: string, exceptId?: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const candidate = slugCandidate(base, attempt);
    if (!(await isSlugTaken(owners, candidate, exceptId))) return candidate;
  }
}

/**
 * Le slug à écrire à la création.
 *
 * Demandé : il doit être libre, sinon `SlugTakenError` avec une suggestion —
 * jamais de remplacement silencieux d'un choix explicite. Absent : dérivé du
 * titre, premier candidat libre. C'est ce second chemin qui laisse les seeds,
 * les scripts et tout appelant antérieur aux slugs créer sans rien fournir.
 */
export async function claimSlug(
  owners: SlugOwners,
  { requested, title, fallback }: { requested?: string; title: string; fallback: string },
): Promise<string> {
  if (requested === undefined) return availableSlug(owners, slugify(title, fallback));
  if (await isSlugTaken(owners, requested)) {
    throw new SlugTakenError(requested, await availableSlug(owners, requested));
  }
  return requested;
}

/**
 * La vérification applicative laisse une fenêtre entre la lecture et
 * l'écriture : deux créations simultanées du même slug passent toutes deux.
 * C'est l'index unique qui tranche, et cette fonction reconnaît son refus.
 */
export function isSlugUniqueViolation(error: any, constraints: readonly string[]): boolean {
  const code = error?.code ?? error?.cause?.code;
  const constraint = error?.constraint ?? error?.cause?.constraint;
  return code === POSTGRES_UNIQUE_VIOLATION && constraints.includes(constraint);
}
