import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Autorisation des routes `/api/cron/*`.
 * --------------------------------------
 * L'appelant (le planificateur de la plateforme) présente
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * La comparaison passe par `timingSafeEqual` et non par `!==` : une égalité de
 * chaînes s'arrête au premier octet différent, et le temps de réponse trahit
 * alors la longueur du préfixe correct. `timingSafeEqual` exige deux tampons de
 * même longueur — on compare donc les SHA-256 des deux valeurs, toujours longs
 * de 32 octets. Une longueur différente ne lève pas et ne fuit rien : elle
 * produit simplement deux hachés différents.
 *
 * Sans `CRON_SECRET` configuré côté serveur, tout est refusé : un secret vide
 * ne doit jamais ouvrir les crons.
 */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const expected = createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  const received = createHash('sha256').update(authHeader).digest();
  return timingSafeEqual(expected, received);
}
