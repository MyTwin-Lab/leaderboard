import "server-only";

/**
 * Client OpenAlex (module watch)
 * ------------------------------
 * `fetch` natif, sans SDK ni clé : OpenAlex est public. Chaque appel porte le
 * `mailto` du réglage du module, en paramètre et dans le `User-Agent`, ce qui
 * vaut l'accès au « polite pool » (plus rapide, moins limité).
 *
 * Garde-fous, par processus : au plus `MAX_REQUESTS_PER_SECOND` appels par
 * seconde, un délai de 8 s par appel, et une seule nouvelle tentative sur 429
 * ou 5xx après 500 ms. Le cache des réponses n'est pas ici : il appartient au
 * service de recherche, qui sait ce qu'une requête normalisée veut dire.
 */

export const OPENALEX_BASE_URL = "https://api.openalex.org";
export const MAX_REQUESTS_PER_SECOND = 5;
export const REQUEST_TIMEOUT_MS = 8_000;
export const RETRY_DELAY_MS = 500;

export type OpenAlexErrorKind = "timeout" | "rate_limited" | "upstream" | "network" | "invalid";

/** Un appel OpenAlex qui n'a pas abouti, avec ce que l'interface peut en dire. */
export class OpenAlexError extends Error {
  constructor(
    public readonly kind: OpenAlexErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OpenAlexError";
  }
}

export interface OpenAlexClientOptions {
  mailto: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  /** Le sémaphore ; par défaut celui du processus. Un test en donne un à lui. */
  limiter?: RateLimiter;
  sleep?: (ms: number) => Promise<void>;
}

export interface OpenAlexClient {
  /** `GET /<path>?<params>` — le JSON décodé. */
  get<T = unknown>(path: string, params: Record<string, string | undefined>): Promise<T>;
}

export interface RateLimiter {
  /** Rend la main quand un appel peut partir sans dépasser la cadence. */
  acquire(): Promise<void>;
}

/**
 * Au plus `maxPerSecond` départs par fenêtre glissante d'une seconde. Les
 * appels s'enchaînent dans une file : deux appels parallèles ne comptent
 * jamais la même fenêtre.
 */
export function createRateLimiter(
  maxPerSecond: number,
  clock: { now(): number; sleep(ms: number): Promise<void> } = { now: Date.now, sleep: defaultSleep },
): RateLimiter {
  const starts: number[] = [];
  let queue: Promise<void> = Promise.resolve();

  return {
    acquire() {
      const turn = queue.then(async () => {
        while (true) {
          const now = clock.now();
          while (starts.length > 0 && now - starts[0] >= 1_000) starts.shift();
          if (starts.length < maxPerSecond) {
            starts.push(now);
            return;
          }
          await clock.sleep(Math.max(1, starts[0] + 1_000 - now));
        }
      });
      // Une file qui ne casse jamais : l'échec d'un tour ne bloque pas les suivants.
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LIMITER_KEY = "__watchOpenAlexRateLimiter";

/** Le sémaphore du processus. Sur `globalThis` : Next peut charger ce module plusieurs fois. */
export function processRateLimiter(): RateLimiter {
  const holder = globalThis as unknown as Record<string, RateLimiter | undefined>;
  holder[LIMITER_KEY] ??= createRateLimiter(MAX_REQUESTS_PER_SECOND);
  return holder[LIMITER_KEY];
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createOpenAlexClient(options: OpenAlexClientOptions): OpenAlexClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? OPENALEX_BASE_URL;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const limiter = options.limiter ?? processRateLimiter();
  const sleep = options.sleep ?? defaultSleep;
  const userAgent = `MyTwinLeaderboard/1.0 (mailto:${options.mailto})`;

  async function attempt(url: URL): Promise<Response> {
    await limiter.acquire();
    try {
      return await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new OpenAlexError("timeout", `OpenAlex did not answer within ${timeoutMs} ms`);
      }
      throw new OpenAlexError("network", error instanceof Error ? error.message : "OpenAlex is unreachable");
    }
  }

  return {
    async get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
      const url = new URL(path, baseUrl);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, value);
      }
      url.searchParams.set("mailto", options.mailto);

      let response = await attempt(url);
      if (isRetryable(response.status)) {
        await sleep(RETRY_DELAY_MS);
        response = await attempt(url);
      }

      if (response.status === 429) throw new OpenAlexError("rate_limited", "OpenAlex is rate limiting this server", 429);
      if (response.status >= 500) throw new OpenAlexError("upstream", `OpenAlex answered ${response.status}`, response.status);
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new OpenAlexError("invalid", `OpenAlex refused the query (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`, response.status);
      }
      try {
        return (await response.json()) as T;
      } catch {
        throw new OpenAlexError("upstream", "OpenAlex answered with an unreadable body", response.status);
      }
    },
  };
}
