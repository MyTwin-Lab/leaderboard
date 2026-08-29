import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
 * Extracts the embedded IPv4 address from an IPv4-mapped (`::ffff:a.b.c.d` or
 * its hex-compressed form `::ffff:xxxx:xxxx`) IPv6 literal, or `null` if the
 * address isn't in that form.
 */
function extractIPv4Mapped(ip: string): string | null {
  const dotted = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];

  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return [
      (high >> 8) & 0xff,
      high & 0xff,
      (low >> 8) & 0xff,
      low & 0xff,
    ].join(".");
  }

  return null;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 literals (e.g. "::ffff:169.254.169.254") embed a real
  // IPv4 address — evaluate it against the IPv4 private ranges rather than
  // the IPv6 prefix rules below, which don't recognize this form.
  const mapped = extractIPv4Mapped(normalized);
  if (mapped) {
    return isPrivateIPv4(mapped);
  }

  return (
    normalized === "::1" ||         // loopback
    normalized.startsWith("fc") ||  // unique local
    normalized.startsWith("fd") ||  // unique local
    normalized.startsWith("fe80")   // link-local
  );
}

/**
 * Blocks proxying a validation request to a private, loopback, link-local, or
 * non-http(s) target. Resolves the hostname once up front — a DNS-rebinding
 * attacker who changes the record between this check and the actual `fetch`
 * call in ValidationChallengeService could still slip through; that gap is a
 * known v1 limitation, not something this guard tries to close.
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

  const literalVersion = isIP(url.hostname.replace(/^\[|\]$/g, ""));
  const addresses = literalVersion
    ? [{ address: url.hostname.replace(/^\[|\]$/g, ""), family: literalVersion }]
    : ((await lookup(url.hostname, { all: true })) as { address: string; family: number }[]);

  if (addresses.length === 0) {
    throw new UnsafeEndpointError(`Could not resolve ${url.hostname}`);
  }

  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (isPrivate) {
      throw new UnsafeEndpointError(`Endpoint resolves to a non-public address: ${address}`);
    }
  }

  return url;
}
