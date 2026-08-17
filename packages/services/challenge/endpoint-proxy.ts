import { assertPublicHttpUrl } from "./ssrf-guard.js";

/** The proxied call itself failed (SSRF-blocked, unreachable, timed out, too large) — a 5xx-shaped problem. */
export class EndpointCallError extends Error {}

export interface ProxyFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/** The raw result of proxying a file to a target's endpoint — no CP, no verdict, no identity. */
export interface ProxyResult {
  status: number;
  contentType: string;
  body: Buffer;
}

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/**
 * SSRF-guarded, redirect-refusing, size-capped POST of a file to a target
 * endpoint. Wraps every failure — including a rejected `assertPublicHttpUrl`
 * check — in `EndpointCallError`.
 *
 * Extracted from `ValidationChallengeService.callEndpointDefault` (its
 * original home) so `ReferenceCaseService.claimCase` can reuse the exact same
 * proxy logic: testing a reference case's input against a live endpoint is
 * the same network operation the old crowd-vote `validate()` used to do.
 */
export async function proxyFileToEndpoint(url: string, file: ProxyFile): Promise<ProxyResult> {
  try {
    await assertPublicHttpUrl(url);

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // `redirect: "manual"` is load-bearing for the SSRF guard: `assertPublicHttpUrl`
      // only validates the URL we were given, not wherever a 3xx response might
      // point. Following redirects automatically would let a malicious target
      // redirect this server-side call to a private address after the check
      // already passed. Node's fetch returns the raw redirect response (not an
      // opaque one) under "manual", so we can detect and reject it explicitly.
      const res = await fetch(url, { method: "POST", body: form, signal: controller.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        throw new Error(`Endpoint responded with a redirect (${res.status}) — redirects are not followed`);
      }
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      return { status: res.status, contentType, body: Buffer.from(arrayBuffer) };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    throw new EndpointCallError(error instanceof Error ? error.message : String(error));
  }
}
