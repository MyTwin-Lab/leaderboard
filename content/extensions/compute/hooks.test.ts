import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ service: { terminateForChallenge: vi.fn() } }));

vi.mock("../../../packages/services/compute/compute-request.service.js", () => ({
  ComputeRequestService: class {
    constructor() {
      return h.service;
    }
  },
}));

import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { computeExtension } from "./index.js";

const CHALLENGE = { uuid: "challenge-1", type: "ml", status: "archived" } as Challenge;
const hooks = computeExtension.hooks!;

beforeEach(() => {
  vi.clearAllMocks();
  h.service.terminateForChallenge.mockResolvedValue(undefined);
});

describe("compute extension — hooks", () => {
  it("cuts the active instances when the challenge closes", async () => {
    await hooks.onClose!(CHALLENGE);

    await vi.waitFor(() => expect(h.service.terminateForChallenge).toHaveBeenCalledWith("challenge-1", "challenge_closed"));
  });

  it("does not make the closing wait for, or fail on, the termination", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.service.terminateForChallenge.mockRejectedValue(new Error("Scaleway down"));

    await expect(hooks.onClose!(CHALLENGE)).resolves.toBeUndefined();

    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it("terminates the instances before the challenge is deleted, and lets a failure stop it", async () => {
    await hooks.onDelete!(CHALLENGE);
    expect(h.service.terminateForChallenge).toHaveBeenCalledWith("challenge-1", "challenge_deleted");

    h.service.terminateForChallenge.mockRejectedValue(new Error("db down"));
    await expect(hooks.onDelete!(CHALLENGE)).rejects.toThrow("db down");
  });
});
