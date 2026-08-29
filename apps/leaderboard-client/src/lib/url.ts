import type { NextRequest } from 'next/server';

/**
 * Narrows a caller-supplied "return here afterwards" path down to something
 * safe to put in a Location header, falling back to the home page.
 *
 * The allowlist is deliberately narrower than "is a valid path": it admits
 * only root-anchored paths made of unreserved characters, so `//evil.com`,
 * `https://evil.com` and `/\evil.com` are all rejected as hosts, and `?`, `#`
 * and `.` never survive. Shared by /signin and /api/google-auth/authorize —
 * both feed the same OAuth round-trip, so a path one accepts and the other
 * rejects would be a bug either way.
 */
export function safeInternalPath(raw: string | null | undefined): string {
  return raw && /^\/[a-zA-Z0-9\-_\/]*$/.test(raw) ? raw : '/';
}

/**
 * Resolves the public base URL from the incoming request.
 *
 * Priority:
 *  1. X-Forwarded-Host / X-Forwarded-Proto headers (set by reverse proxies like Scalingo, Heroku, Vercel)
 *  2. Host header
 *  3. NEXT_PUBLIC_APP_URL env var
 *  4. request.nextUrl (internal container host — last resort)
 */
export function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host) {
    const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}
