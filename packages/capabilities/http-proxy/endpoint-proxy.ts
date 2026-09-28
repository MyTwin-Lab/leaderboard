import { assertPublicHttpUrl, createGuardedLookup } from "./ssrf-guard.js";

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
 * Dispatcher undici dont la résolution DNS passe par `createGuardedLookup`.
 *
 * `undici` n'est pas une dépendance du dépôt : on réutilise la classe `Agent`
 * embarquée par Node pour son `fetch` global. Node l'expose sous
 * `Symbol.for("undici.globalDispatcher.1")` dès que son implémentation web est
 * chargée — ce que fait n'importe quelle construction de `Response`, sans
 * aucun appel réseau ni appel à `fetch`.
 *
 * Mis en cache : un seul agent pour le processus. Son `lookup` est rejoué à
 * chaque nouvelle connexion, donc une connexion réutilisée a déjà été
 * contrôlée à son ouverture.
 */
let pinnedDispatcher: object | null = null;

function getPinnedDispatcher(): object {
  if (pinnedDispatcher) return pinnedDispatcher;

  void new Response("");
  const globalDispatcher = (globalThis as Record<symbol, unknown>)[Symbol.for("undici.globalDispatcher.1")];
  const AgentClass = (globalDispatcher as { constructor?: unknown } | undefined)?.constructor;
  if (typeof AgentClass !== "function") {
    // Échec fermé : sans résolution épinglée, le DNS rebinding redevient
    // possible. Mieux vaut une validation en erreur qu'un appel non gardé.
    throw new Error("Pinned DNS dispatcher unavailable in this runtime — refusing an unguarded endpoint call");
  }

  pinnedDispatcher = new (AgentClass as new (options: object) => object)({
    connect: { lookup: createGuardedLookup() },
  });
  return pinnedDispatcher;
}

/**
 * SSRF-guarded, DNS-pinned, redirect-refusing, size-capped POST of a file to a
 * target endpoint. Wraps every failure — including a rejected
 * `assertPublicHttpUrl` check — in `EndpointCallError`.
 *
 * Extracted from `ValidationChallengeService.callEndpointDefault` (its
 * original home) so `ReferenceCaseService.claimCase` can reuse the exact same
 * proxy logic: testing a reference case's input against a live endpoint is
 * the same network operation the old crowd-vote `validate()` used to do.
 */
export async function proxyFileToEndpoint(url: string, file: ProxyFile): Promise<ProxyResult> {
  try {
    // Contrôle précoce, pour une erreur claire. Le contrôle qui fait foi est
    // celui du dispatcher ci-dessous, rejoué sur l'adresse réellement connectée.
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
      //
      // `dispatcher` épingle la résolution DNS : sans lui, `fetch` résoudrait le
      // nom une seconde fois, et un enregistrement à TTL nul pourrait alors
      // pointer vers 127.0.0.1 ou 169.254.169.254 (DNS rebinding).
      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
        redirect: "manual",
        dispatcher: getPinnedDispatcher(),
      } as RequestInit);
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
