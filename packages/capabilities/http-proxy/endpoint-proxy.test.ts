import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

vi.mock("../../config/index.js", () => ({
  config: { validation: { allowPrivateEndpoints: false } },
}));

import { lookup } from "node:dns/promises";
import { proxyFileToEndpoint, EndpointCallError } from "./endpoint-proxy.js";

const mockLookup = vi.mocked(lookup);

const FILE = { buffer: Buffer.from("input"), filename: "in.json", mimeType: "application/json" };

describe("proxyFileToEndpoint — résolution DNS épinglée", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  it("bloque le DNS rebinding : public au contrôle, 127.0.0.1 à la connexion", async () => {
    // Premier appel : assertPublicHttpUrl voit une IP publique. Second appel :
    // la connexion réelle résout à nouveau et obtient la loopback.
    mockLookup
      .mockResolvedValueOnce([{ address: "203.0.113.10", family: 4 }] as any)
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as any);

    const call = proxyFileToEndpoint("http://rebind.example.test:8080/predict", FILE);

    await expect(call).rejects.toThrow(EndpointCallError);
    // Le contrôle précoce est passé, c'est bien la résolution de connexion qui a bloqué.
    expect(mockLookup).toHaveBeenCalledTimes(2);
  });

  it("refuse toujours un littéral privé avant tout appel réseau", async () => {
    await expect(proxyFileToEndpoint("http://[::7f00:1]:8080/predict", FILE)).rejects.toThrow(
      /non-public address/
    );
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
