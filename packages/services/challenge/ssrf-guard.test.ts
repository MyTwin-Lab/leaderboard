import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { assertPublicHttpUrl, UnsafeEndpointError } from "./ssrf-guard.js";

const mockLookup = vi.mocked(lookup);

describe("assertPublicHttpUrl", () => {
  beforeEach(() => mockLookup.mockReset());

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
});
