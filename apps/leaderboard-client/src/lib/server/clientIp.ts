import { createHmac } from "node:crypto";
import { config } from "../../../../../packages/config";
import { hashIp, pickClientIp } from "../../../../../packages/services/sandbox/starPolicy";

/**
 * L'IP du client, telle que les routes de star la consomment.
 *
 * Simple câblage : la logique (ordre des en-têtes, proxys de confiance, HMAC,
 * préfixe de domaine) vit dans `packages/services/sandbox/starPolicy.ts`, pur
 * et testé là-bas. Ce fichier ne fait que lui apporter la clé et les en-têtes
 * de la requête — aucune lecture de `x-forwarded-for` ici, pour qu'il n'existe
 * qu'une seule règle.
 *
 * Rappel de l'invariant : l'IP sert **au débit, jamais à l'unicité**. Une
 * université sort derrière une seule adresse — l'unicité est portée par le
 * cookie signé et par les index uniques partiels de `sandbox_stars`.
 */

/** Libellé de dérivation : une clé par usage, jamais le secret JWT brut. */
const IP_HASH_KEY_LABEL = "ip-hash";

/**
 * Clé HMAC des IP, dérivée du secret JWT : HMAC(jwtSecret, "ip-hash").
 *
 * Le secret JWT signe les sessions ; s'en servir directement comme clé d'un
 * second usage mêlerait deux domaines cryptographiques. La dérivation garde
 * une seule variable d'environnement à gérer tout en séparant les clés.
 */
export function ipHashKey(jwtSecret: string): string {
  return createHmac("sha256", jwtSecret).update(IP_HASH_KEY_LABEL).digest("hex");
}

/** L'IP vue par le proxy de confiance, ou `127.0.0.1` en développement local. */
export function clientIp(request: Request): string {
  return pickClientIp(request.headers);
}

/**
 * Le haché stocké dans `sandbox_stars.ip_hash`. Jamais l'IP en clair — et le
 * haché lui-même est purgé au-delà de 30 jours (service et cron quotidien).
 */
export function clientIpHash(request: Request): string {
  return hashIp(clientIp(request), ipHashKey(config.auth.jwtSecret));
}
