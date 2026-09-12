import { config } from "../../../../../packages/config";
import { hashIp, pickClientIp } from "../../../../../packages/services/sandbox/starPolicy";

/**
 * L'IP du client, telle que les routes de star la consomment.
 *
 * Simple câblage : la logique (ordre des en-têtes, HMAC, préfixe de domaine)
 * vit dans `packages/services/sandbox/starPolicy.ts`, pur et testé là-bas. Ce
 * fichier ne fait que lui apporter le secret et les en-têtes de la requête.
 *
 * Rappel de l'invariant : l'IP sert **au débit, jamais à l'unicité**. Une
 * université sort derrière une seule adresse — l'unicité est portée par le
 * cookie signé et par les index uniques partiels de `sandbox_stars`.
 */

/** L'IP vue par le reverse proxy, ou `127.0.0.1` en développement local. */
export function clientIp(request: Request): string {
  return pickClientIp(request.headers);
}

/**
 * Le haché stocké dans `sandbox_stars.ip_hash`. Jamais l'IP en clair — et le
 * haché lui-même est purgé au-delà de 30 jours par le service.
 */
export function clientIpHash(request: Request): string {
  return hashIp(clientIp(request), config.auth.jwtSecret);
}
