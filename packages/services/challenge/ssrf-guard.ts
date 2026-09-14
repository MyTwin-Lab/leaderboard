import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import { config } from "../../config/index.js";

export class UnsafeEndpointError extends Error {}

/** [network base, prefix length] — ranges that must never be reachable from a proxied validation call. */
const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],       // "this" network
  ["10.0.0.0", 8],      // RFC1918
  ["100.64.0.0", 10],   // carrier-grade NAT
  ["127.0.0.0", 8],     // loopback
  ["169.254.0.0", 16],  // link-local (incl. cloud metadata: 169.254.169.254)
  ["172.16.0.0", 12],   // RFC1918
  ["192.0.0.0", 24],    // IETF protocol assignments
  ["192.168.0.0", 16],  // RFC1918
  ["198.18.0.0", 15],   // benchmarking
  ["224.0.0.0", 4],     // multicast
  ["240.0.0.0", 4],     // réservé, broadcast 255.255.255.255 compris
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

/**
 * Parse un littéral IPv6 en ses 8 groupes de 16 bits, ou `null` s'il est
 * invalide. Gère la compression `::`, la zone `%eth0` et la queue en notation
 * pointée (`::ffff:1.2.3.4`). Travailler sur les groupes plutôt que sur des
 * préfixes de chaîne évite les formes qui passaient au travers (`[::]`,
 * `[::7f00:1]`, `[64:ff9b::a9fe:a9fe]`) : une même adresse s'écrit de
 * beaucoup de façons.
 */
function parseIPv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  const zoneIndex = ip.indexOf("%");
  if (zoneIndex !== -1) ip = ip.slice(0, zoneIndex);

  const lastColon = ip.lastIndexOf(":");
  if (lastColon === -1) return null;
  const tail = ip.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (isIP(tail) !== 4) return null;
    const n = ipv4ToInt(tail);
    ip = `${ip.slice(0, lastColon + 1)}${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...new Array(missing).fill("0"), ...rest];
  }

  const values = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : Number.NaN));
  return values.some(Number.isNaN) ? null : values;
}

function embeddedIPv4(high: number, low: number): string {
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
}

function isPrivateIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  // Illisible : on refuse plutôt que de laisser passer une forme inconnue.
  if (!g) return true;

  const zerosUpTo = (count: number) => g.slice(0, count).every((group) => group === 0);

  // ::ffff:0:0/96 (IPv4-mapped) — l'IPv4 embarquée décide.
  if (zerosUpTo(5) && g[5] === 0xffff) return isPrivateIPv4(embeddedIPv4(g[6], g[7]));
  // ::ffff:0:0:0/96 (IPv4-translated) — idem.
  if (zerosUpTo(4) && g[4] === 0xffff && g[5] === 0) return isPrivateIPv4(embeddedIPv4(g[6], g[7]));
  // ::/96 — `::` (non spécifiée), `::1` (loopback) et les adresses
  // IPv4-compatibles dépréciées (`::7f00:1`) : aucun usage légitime, tout bloqué.
  if (zerosUpTo(6)) return true;
  // 64:ff9b::/96 (NAT64 bien connu) — l'IPv4 embarquée décide.
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIPv4(embeddedIPv4(g[6], g[7]));
  }
  // 64:ff9b:1::/48 (NAT64 à usage local, RFC 8215).
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true;
  // 2002::/16 (6to4) et 2001::/32 (Teredo) — embarquent une IPv4 joignable par tunnel.
  if (g[0] === 0x2002) return true;
  if (g[0] === 0x2001 && g[1] === 0) return true;
  // fc00::/7 (unique local).
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 (link-local, tout le préfixe et pas seulement `fe80:`) et fec0::/10 (site-local déprécié).
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true;
  // ff00::/8 (multicast).
  if ((g[0] & 0xff00) === 0xff00) return true;

  return false;
}

/** Vrai si l'adresse n'est pas une adresse publique joignable sans risque. */
export function isNonPublicAddress(address: string, family?: number): boolean {
  const version = family === 4 || family === 6 ? family : isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

export type AddressResolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const systemResolver: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true })) as { address: string; family: number }[];

/**
 * Résout `hostname` (ou lit le littéral IP) et lève `UnsafeEndpointError` si
 * une seule des adresses obtenues n'est pas publique.
 */
export async function resolvePublicAddresses(
  hostname: string,
  resolver: AddressResolver = systemResolver
): Promise<{ address: string; family: number }[]> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  const literalVersion = isIP(bare);
  const addresses = literalVersion ? [{ address: bare, family: literalVersion }] : await resolver(bare);

  if (addresses.length === 0) {
    throw new UnsafeEndpointError(`Could not resolve ${hostname}`);
  }

  for (const { address, family } of addresses) {
    if (isNonPublicAddress(address, family)) {
      throw new UnsafeEndpointError(`Endpoint resolves to a non-public address: ${address}`);
    }
  }

  return addresses;
}

/**
 * Fonction `lookup` pour `net.connect` / `http.request` / un `undici.Agent`,
 * qui **épingle** la vérification à la résolution réellement utilisée pour se
 * connecter. C'est ce qui ferme le DNS rebinding : `assertPublicHttpUrl`
 * contrôle une première résolution, mais la connexion en fait une seconde, et
 * un enregistrement DNS à TTL nul peut répondre une IP publique puis
 * `127.0.0.1`. Avec cette fonction, la seconde résolution est contrôlée elle
 * aussi, et c'est son résultat — pas un autre — qui sert au `connect`.
 *
 * Respecte `VALIDATION_ALLOW_PRIVATE_ENDPOINTS` (développement local), lu à
 * chaque appel comme dans `assertPublicHttpUrl`.
 */
export function createGuardedLookup(resolver: AddressResolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    const resolution = config.validation.allowPrivateEndpoints
      ? resolver(hostname)
      : resolvePublicAddresses(hostname, resolver);

    resolution.then(
      (addresses) => {
        const rawFamily = (options as { family?: unknown } | undefined)?.family;
        const wanted = rawFamily === 4 || rawFamily === "IPv4" ? 4 : rawFamily === 6 || rawFamily === "IPv6" ? 6 : 0;
        const candidates = wanted ? addresses.filter((a) => a.family === wanted) : addresses;

        if (candidates.length === 0) {
          const error = Object.assign(new Error(`No usable address for ${hostname}`), { code: "ENOTFOUND" });
          callback(error, "", 0);
          return;
        }
        if ((options as { all?: boolean } | undefined)?.all) {
          callback(null, candidates.map((a) => ({ address: a.address, family: a.family })));
        } else {
          callback(null, candidates[0].address, candidates[0].family);
        }
      },
      (error) => callback(error as NodeJS.ErrnoException, "", 0)
    );
  };
}

/**
 * Blocks proxying a validation request to a private, loopback, link-local, or
 * non-http(s) target. Resolves the hostname once up front for an early, clear
 * error; the actual connection must additionally go through
 * `createGuardedLookup` (see endpoint-proxy.ts), which re-checks the address
 * it really connects to — that is what closes the DNS-rebinding gap.
 *
 * `VALIDATION_ALLOW_PRIVATE_ENDPOINTS=true` skips the private/loopback block
 * entirely — local dev only (see packages/config), so a test model API
 * running on the same machine as the app can be validated. Never set in
 * production: this is the one thing standing between a validator and SSRF.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeEndpointError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeEndpointError(`Unsupported scheme: ${url.protocol}`);
  }

  if (config.validation.allowPrivateEndpoints) {
    return url;
  }

  if (url.hostname === "localhost") {
    throw new UnsafeEndpointError("Endpoint resolves to a local address");
  }

  await resolvePublicAddresses(url.hostname);

  return url;
}
