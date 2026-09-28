import { describe, it, expect, vi } from "vitest";
import { createOpenAlexClient, createRateLimiter, OpenAlexError, RETRY_DELAY_MS } from "./openalex";

const noLimit = { acquire: async () => {} };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createOpenAlexClient", () => {
  it("signs every call with the mailto, as a parameter and in the User-Agent", async () => {
    const fetchImpl = vi.fn(async () => json({ ok: true }));
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: noLimit });

    await client.get("/works", { search: "liver", filter: "type:article", empty: "", missing: undefined });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe("https://api.openalex.org");
    expect(url.pathname).toBe("/works");
    expect(url.searchParams.get("search")).toBe("liver");
    expect(url.searchParams.get("filter")).toBe("type:article");
    expect(url.searchParams.get("mailto")).toBe("lab@example.org");
    expect(url.searchParams.has("empty")).toBe(false);
    expect(url.searchParams.has("missing")).toBe(false);
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("MyTwinLeaderboard/1.0 (mailto:lab@example.org)");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once on 429 or 5xx after the delay, then gives up with a typed error", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => json({ error: "slow down" }, 429));
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: noLimit, sleep });

    const error = await client.get("/works", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OpenAlexError);
    expect((error as OpenAlexError).kind).toBe("rate_limited");
    expect((error as OpenAlexError).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(RETRY_DELAY_MS);
  });

  it("succeeds when the retry answers", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ results: [1] }));
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: noLimit, sleep: async () => {} });

    expect(await client.get("/works", {})).toEqual({ results: [1] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx that is not a rate limit, and reports it as an invalid query", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad filter", { status: 400 }));
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: noLimit });

    const error = await client.get("/works", {}).catch((e: unknown) => e);

    expect((error as OpenAlexError).kind).toBe("invalid");
    expect((error as OpenAlexError).message).toContain("bad filter");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("turns an aborted fetch into a timeout error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: noLimit });

    const error = await client.get("/works", {}).catch((e: unknown) => e);
    expect((error as OpenAlexError).kind).toBe("timeout");
  });

  it("waits for the limiter before every attempt", async () => {
    const acquire = vi.fn(async () => {});
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({}));
    const client = createOpenAlexClient({ mailto: "lab@example.org", fetchImpl, limiter: { acquire }, sleep: async () => {} });

    await client.get("/works", {});
    expect(acquire).toHaveBeenCalledTimes(2);
  });
});

describe("createRateLimiter", () => {
  it("lets at most N calls start per sliding second, and makes the next one wait", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter(2, {
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    expect(waits).toEqual([]);

    await limiter.acquire();
    expect(waits).toEqual([1_000]);
    expect(now).toBe(1_000);

    now = 1_500;
    await limiter.acquire();
    // Un départ à 0 est sorti de la fenêtre, un à 1 000 reste : la place est là.
    expect(waits).toEqual([1_000]);
  });

  it("serializes parallel callers through its queue", async () => {
    let now = 0;
    const limiter = createRateLimiter(1, { now: () => now, sleep: async (ms) => void (now += ms) });
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((n) => limiter.acquire().then(() => order.push(n))));
    expect(order).toEqual([1, 2, 3]);
    expect(now).toBe(2_000);
  });
});
