import type { NextRequest } from 'next/server';

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
