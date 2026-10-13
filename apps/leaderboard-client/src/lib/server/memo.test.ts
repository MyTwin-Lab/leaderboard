import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { memoize } from "./memo";

describe("memoize", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("relit une fois le délai écoulé, pas avant", async () => {
    const load = vi.fn(async () => load.mock.calls.length);
    const cached = memoize(1_000, load);

    expect(await cached()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(await cached()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(await cached()).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("fait partager une seule lecture aux appels concurrents", async () => {
    const load = vi.fn(async () => "overview");
    const cached = memoize(1_000, load);

    const results = await Promise.all([cached(), cached(), cached()]);

    expect(results).toEqual(["overview", "overview", "overview"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("garde une entrée par clé", async () => {
    const load = vi.fn(async (projectId: string) => projectId);
    const cached = memoize(1_000, load, (projectId) => projectId);

    expect(await cached("p1")).toBe("p1");
    expect(await cached("p2")).toBe("p2");
    expect(await cached("p1")).toBe("p1");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("ne garde pas un échec", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("ok");
    const cached = memoize(1_000, load);

    await expect(cached()).rejects.toThrow("db down");
    expect(await cached()).toBe("ok");
  });

  it("relit à chaque appel hors production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const load = vi.fn(async () => "overview");
    const cached = memoize(1_000, load);

    await cached();
    await cached();

    expect(load).toHaveBeenCalledTimes(2);
  });
});
