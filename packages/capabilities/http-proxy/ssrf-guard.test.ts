import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

vi.mock("../../config/index.js", () => ({
  config: { validation: { allowPrivateEndpoints: false } },
}));

import { lookup } from "node:dns/promises";
import { config } from "../../config/index.js";
import { assertPublicHttpUrl, createGuardedLookup, UnsafeEndpointError } from "./ssrf-guard.js";

const mockLookup = vi.mocked(lookup);

describe("assertPublicHttpUrl", () => {
  beforeEach(() => {
    mockLookup.mockReset();
    config.validation.allowPrivateEndpoints = false;
  });

  it("rejects a non-http(s) scheme", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com/x")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an unparseable URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects localhost by hostname", async () => {
    await expect(assertPublicHttpUrl("http://localhost:3000/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects a hostname resolving to a private IPv4 address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as any);
    await expect(assertPublicHttpUrl("https://internal.example.com/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects the cloud metadata address", async () => {
    mockLookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as any);
    await expect(assertPublicHttpUrl("https://metadata.example.com/")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an IPv6 loopback literal directly in the URL", async () => {
    await expect(assertPublicHttpUrl("http://[::1]:8080/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an IPv4-mapped IPv6 literal pointing at the cloud metadata address", async () => {
    await expect(
      assertPublicHttpUrl("http://[::ffff:169.254.169.254]/latest/meta-data/")
    ).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an IPv4-mapped IPv6 literal in dotted-quad form", async () => {
    await expect(assertPublicHttpUrl("http://[::ffff:127.0.0.1]:8080/predict")).rejects.toThrow(
      UnsafeEndpointError
    );
  });

  it.each([
    ["the unspecified address", "http://[::]/predict"],
    ["an IPv4-compatible loopback", "http://[::7f00:1]/predict"],
    ["a NAT64 address embedding the metadata IP", "http://[64:ff9b::a9fe:a9fe]/latest/meta-data/"],
    ["NAT64 in dotted form", "http://[64:ff9b::169.254.169.254]/"],
    ["an IPv4-translated loopback", "http://[::ffff:0:7f00:1]/"],
    ["6to4", "http://[2002:a9fe:a9fe::1]/"],
    ["the whole fe80::/10, not just fe80:", "http://[febf::1]/"],
    ["unique local", "http://[fd12:3456::1]/"],
    ["IPv6 multicast", "http://[ff02::1]/"],
    ["IPv4 multicast", "http://224.0.0.251/"],
    ["IPv4 reserved 240/4", "http://240.0.0.1/"],
    ["the IPv4 broadcast", "http://255.255.255.255/"],
  ])("rejects %s", async (_label, url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(UnsafeEndpointError);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it.each([
    ["a public IPv6 literal", "http://[2606:4700:4700::1111]/"],
    ["a NAT64 address embedding a public IPv4", "http://[64:ff9b::808:808]/"],
    ["a public IPv4 literal", "http://203.0.113.10/"],
  ])("accepts %s", async (_label, url) => {
    await expect(assertPublicHttpUrl(url)).resolves.toBeInstanceOf(URL);
  });

  it("rejects a hostname whose resolver answers 127.0.0.1", async () => {
    mockLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as any);
    await expect(assertPublicHttpUrl("https://rebind.example.com/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("accepts a hostname resolving only to public addresses", async () => {
    mockLookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as any);
    const url = await assertPublicHttpUrl("https://model.example.com/predict");
    expect(url.hostname).toBe("model.example.com");
  });

  it("rejects when any resolved address (of several) is private", async () => {
    mockLookup.mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
      { address: "192.168.1.1", family: 4 },
    ] as any);
    await expect(assertPublicHttpUrl("https://model.example.com/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  describe("with VALIDATION_ALLOW_PRIVATE_ENDPOINTS enabled", () => {
    beforeEach(() => {
      config.validation.allowPrivateEndpoints = true;
    });

    it("accepts localhost", async () => {
      const url = await assertPublicHttpUrl("http://localhost:8080/predict");
      expect(url.hostname).toBe("localhost");
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it("accepts a private IPv4 literal", async () => {
      const url = await assertPublicHttpUrl("http://192.168.1.50:8080/predict");
      expect(url.hostname).toBe("192.168.1.50");
    });

    it("still rejects a non-http(s) scheme", async () => {
      await expect(assertPublicHttpUrl("ftp://example.com/x")).rejects.toThrow(UnsafeEndpointError);
    });
  });
});

type LookupOutcome = { err: NodeJS.ErrnoException | null; address: unknown; family?: number };

function runLookup(
  lookupFn: ReturnType<typeof createGuardedLookup>,
  hostname: string,
  options: Record<string, unknown> = {}
): Promise<LookupOutcome> {
  return new Promise((resolve) => {
    lookupFn(hostname, options as any, (err, address, family) => resolve({ err, address, family }));
  });
}

describe("createGuardedLookup — the resolution pinned to the actual connection", () => {
  beforeEach(() => {
    config.validation.allowPrivateEndpoints = false;
  });

  it("refuses to connect when the fake resolver answers 127.0.0.1", async () => {
    const guarded = createGuardedLookup(async () => [{ address: "127.0.0.1", family: 4 }]);
    const outcome = await runLookup(guarded, "evil.example.com");
    expect(outcome.err).toBeInstanceOf(UnsafeEndpointError);
  });

  it("closes DNS rebinding: public at check time, private at connect time", async () => {
    const answers = [
      [{ address: "203.0.113.10", family: 4 }],
      [{ address: "169.254.169.254", family: 4 }],
    ];
    const resolver = vi.fn(async () => answers.shift()!);
    const guarded = createGuardedLookup(resolver);

    expect((await runLookup(guarded, "rebind.example.com")).err).toBeNull();
    expect((await runLookup(guarded, "rebind.example.com")).err).toBeInstanceOf(UnsafeEndpointError);
  });

  it("hands the checked address to the connection", async () => {
    const guarded = createGuardedLookup(async () => [{ address: "203.0.113.10", family: 4 }]);
    const outcome = await runLookup(guarded, "model.example.com");
    expect(outcome).toEqual({ err: null, address: "203.0.113.10", family: 4 });
  });

  it("supports the all:true form used by happy-eyeballs connects", async () => {
    const guarded = createGuardedLookup(async () => [
      { address: "203.0.113.10", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    const outcome = await runLookup(guarded, "model.example.com", { all: true });
    expect(outcome.err).toBeNull();
    expect(outcome.address).toEqual([
      { address: "203.0.113.10", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
  });

  it("still lets a private address through when VALIDATION_ALLOW_PRIVATE_ENDPOINTS is on", async () => {
    config.validation.allowPrivateEndpoints = true;
    const guarded = createGuardedLookup(async () => [{ address: "127.0.0.1", family: 4 }]);
    const outcome = await runLookup(guarded, "localhost");
    expect(outcome).toEqual({ err: null, address: "127.0.0.1", family: 4 });
  });
});
