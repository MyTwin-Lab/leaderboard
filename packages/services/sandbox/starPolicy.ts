import { createHmac } from "node:crypto";

/**
 * Politique anti-abus des stars — pur, sans I/O.
 * ---------------------------------------------
 * Deux principes, tenus par tout ce fichier :
 *
 * 1. **L'IP sert au débit, jamais à l'unicité.** Une université ou une
 *    entreprise sort derrière une seule adresse : faire porter l'unicité par
 *    l'IP bloquerait de vrais utilisateurs les uns par les autres. L'unicité
 *    est portée par le cookie signé (`anon_id`) et par les index uniques
 *    partiels de `sandbox_stars`.
 * 2. **Jamais d'IP en clair.** Elle n'est stockée que sous forme de HMAC, avec
 *    un secret serveur, et le haché est purgé au-delà de la rétention.
 */

/**
 * Plafond horaire des stars anonymes par IP hachée.
 *
 * Appliqué aux seules stars anonymes : un compte est déjà borné à une star par
 * sandbox par l'index unique `(sandbox_id, user_id)`. Le message du 429 invite
 * à se connecter — c'est la sortie d'un vrai utilisateur derrière une IP
 * partagée qui atteindrait le plafond.
 */
export const STAR_RATE_LIMIT_PER_HOUR = 30;

/** Rétention RGPD du haché d'IP, en jours. Au-delà, seul le haché est effacé — la star reste. */
export const IP_HASH_RETENTION_DAYS = 30;

/** Repli quand la requête ne porte aucun en-tête de proxy (développement local). */
export const FALLBACK_CLIENT_IP = "127.0.0.1";

/**
 * Nombre de proxys de confiance devant l'app, par défaut 1 : le routeur de la
 * plateforme, qui **ajoute** à `x-forwarded-for` l'adresse qu'il voit. Réglable
 * par `TRUSTED_PROXY_HOPS` si un CDN s'intercale un jour (il faudrait alors 2).
 */
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/** Lit `TRUSTED_PROXY_HOPS` ; toute valeur absente, non entière ou < 1 retombe sur le défaut. */
export function trustedProxyHops(raw: string | undefined = process.env.TRUSTED_PROXY_HOPS): number {
  if (raw === undefined || !/^\s*\d+\s*$/.test(raw)) return DEFAULT_TRUSTED_PROXY_HOPS;
  const hops = Number.parseInt(raw, 10);
  return hops >= 1 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Préfixe du message HMAC. Il domaine le haché : le même secret utilisé
 * ailleurs ne peut pas produire une valeur qui se confonde avec un haché d'IP.
 */
const IP_HASH_PREFIX = "sandbox-ip:";

/**
 * HMAC-SHA256(secret, "sandbox-ip:" + ip), en hexadécimal — 64 caractères,
 * exactement la largeur de `sandbox_stars.ip_hash`.
 *
 * Le secret n'est jamais le secret des JWT lui-même : l'appelant passe une clé
 * dérivée par usage (`clientIp.ts`), pour qu'une même clé ne serve pas à
 * signer des sessions et à hacher des IP. Une rotation invalide les hachés
 * existants, ce qui est indolore vu la rétention de 30 jours — les hachés
 * anciens ne servent plus au débit, seulement à l'audit.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`${IP_HASH_PREFIX}${ip}`).digest("hex");
}

/**
 * Ce dont `pickClientIp` a besoin : un `Headers` du runtime web, ou un objet
 * simple. Les deux formes existent selon l'appelant (route Next, test).
 */
export type HeaderSource =
  | { get(name: string): string | null | undefined }
  | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string | null {
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(n: string): string | null | undefined }).get(name) ?? null;
  }
  const raw = (headers as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/**
 * L'IP du client telle que la voit le reverse proxy.
 *
 * `x-forwarded-for` est une liste `client, proxy1, proxy2` où chaque proxy
 * **ajoute** l'adresse qu'il voit. Seules les entrées de droite, écrites par
 * nos propres proxys, sont fiables : tout ce qui est à gauche a pu être posé
 * par le client lui-même. Prendre le premier élément laissait donc un visiteur
 * sans cookie changer d'IP à chaque requête et contourner le plafond horaire —
 * or les paliers d'étoiles rapportent des CP.
 *
 * On prend `list[list.length - hops]` : avec un seul proxy de confiance,
 * la dernière entrée. Si la liste est plus courte que `hops`, on borne à la
 * première entrée plutôt que de lire hors du tableau.
 */
export function pickClientIp(headers: HeaderSource, hops: number = trustedProxyHops()): string {
  const forwarded = readHeader(headers, "x-forwarded-for");
  if (forwarded) {
    const list = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (list.length > 0) {
      const safeHops = Number.isInteger(hops) && hops >= 1 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
      return list[Math.max(0, list.length - safeHops)];
    }
  }
  const real = readHeader(headers, "x-real-ip")?.trim();
  if (real) return real;
  return FALLBACK_CLIENT_IP;
}

/** Le plafond est atteint, pas seulement approché : `>=`, sinon la 31e passerait. */
export function isRateLimited(countInWindow: number): boolean {
  return countInWindow >= STAR_RATE_LIMIT_PER_HOUR;
}

/** Borne basse de la fenêtre de débit — une heure glissante. */
export function rateLimitWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - 60 * 60 * 1000);
}

/** Date avant laquelle un haché d'IP doit être effacé. */
export function ipHashRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - IP_HASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
