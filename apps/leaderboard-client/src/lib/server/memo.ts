import "server-only";

/**
 * Garde en mémoire, `ttlMs` durant, le résultat d'une lecture publique et
 * coûteuse — l'accueil et le classement relisent des tables entières à chaque
 * appel. Une rafale de requêtes (bots, partage d'un lien) les relançait autant
 * de fois, et le conteneur finissait en swap.
 *
 * Les appels concurrents d'une même clé partagent la même promesse : un seul
 * passage en base, même quand cent requêtes arrivent avant la première
 * réponse. Un échec n'est pas gardé, l'appel suivant relit.
 *
 * Ne convient qu'à des données qui ne dépendent pas du visiteur. Hors
 * production (dev, tests), chaque appel relit : une modification se voit
 * aussitôt, et les tests gardent la main sur leurs doublures.
 */
export function memoize<Args extends unknown[], T>(
  ttlMs: number,
  load: (...args: Args) => Promise<T>,
  keyOf: (...args: Args) => string = () => "",
): (...args: Args) => Promise<T> {
  const entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

  return (...args: Args) => {
    if (process.env.NODE_ENV !== "production") return load(...args);

    const key = keyOf(...args);
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const value = load(...args);
    entries.set(key, { value, expiresAt: now + ttlMs });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}
