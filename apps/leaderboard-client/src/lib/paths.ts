/**
 * Les URLs des pages publiques d'un challenge et d'un sandbox.
 *
 * Toujours bâties sur le **slug**, jamais sur l'UUID : une page servie à son
 * UUID redirige (308), et un lien qui y mène coûte un aller-retour — et, pour
 * un moteur, un signal de canonique moins net. Les routes d'API, elles,
 * restent sur l'UUID ; les URLs admin (`/admin/challenges/<uuid>`) aussi.
 *
 * Pur et sans import : utilisable côté client comme côté serveur.
 */

export function challengePath(slug: string): string {
  return `/challenges/${slug}`;
}

export function challengeManagePath(slug: string): string {
  return `/challenges/${slug}/manage`;
}

/** Le lien d'invitation d'un groupe : c'est lui, l'invitation (docs/challenge-groups.md). */
export function challengeInvitePath(slug: string, groupToken: string): string {
  return `${challengePath(slug)}?group=${encodeURIComponent(groupToken)}`;
}

export function sandboxPath(slug: string): string {
  return `/sandbox/${slug}`;
}

/**
 * `path` suivi de la query d'origine, telle que Next la passe à une page
 * (`searchParams`). Sert aux redirections vers l'URL canonique, qui doivent
 * garder `?group=` : un lien d'invitation partagé avant les slugs porte le
 * jeton dans sa query.
 */
export function withSearchParams(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}
