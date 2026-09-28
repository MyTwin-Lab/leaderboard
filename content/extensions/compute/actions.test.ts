import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  computeRequestRepo: { findByChallengeAndUser: vi.fn(), findByChallenge: vi.fn() },
  userRepo: { findByIds: vi.fn() },
  service: { requestCompute: vi.fn(), revealToken: vi.fn(), decide: vi.fn(), retryProvisioning: vi.fn() },
}));

vi.mock("../../../packages/database-service/repositories/index.js", () => ({
  ComputeRequestRepository: class {
    constructor() {
      return h.computeRequestRepo;
    }
  },
  UserRepository: class {
    constructor() {
      return h.userRepo;
    }
  },
}));

vi.mock("../../../packages/services/compute/compute-request.service.js", () => ({
  ComputeRequestService: class {
    constructor() {
      return h.service;
    }
  },
}));

const mockFindByChallengeAndUser = h.computeRequestRepo.findByChallengeAndUser;
const mockFindByChallenge = h.computeRequestRepo.findByChallenge;
const mockFindByIds = h.userRepo.findByIds;
const mockRequestCompute = h.service.requestCompute;
const mockRevealToken = h.service.revealToken;
const mockDecide = h.service.decide;
const mockRetryProvisioning = h.service.retryProvisioning;

import { actionContext } from "../../../packages/capabilities/testing/action-context.js";
import { decide, listRequests, ownRequest, requestCompute, revealToken } from "./actions.js";
import { computeExtension } from "./index.js";

const CHALLENGE_ID = "challenge-1";
const USER_ID = "user-1";

const ctx = (options: Parameters<typeof actionContext>[0] = {}) =>
  actionContext({ challenge: { uuid: CHALLENGE_ID, type: "ml" }, user: { id: USER_ID }, ...options });

async function read(result: unknown): Promise<{ status: number; body: unknown }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("compute extension — declared access", () => {
  const access = (method: string, path: string) =>
    computeExtension.actions?.find((a) => a.method === method && a.path === path)?.access;

  it("lets any signed-in contributor handle their own request", () => {
    expect(access("GET", "request")).toEqual({});
    expect(access("POST", "request")).toEqual({});
    expect(access("POST", "request/reveal-token")).toEqual({});
  });

  it("keeps the list and the decisions to an admin or the challenge's manager", () => {
    expect(access("GET", "requests")).toEqual({ roles: ["admin"], manager: true });
    expect(access("POST", "requests/:requestId/decision")).toEqual({ roles: ["admin"], manager: true });
  });
});

describe("GET request", () => {
  it("returns null when the user has no compute request on this challenge", async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    expect(await ownRequest(ctx())).toEqual({ request: null });
    expect(mockFindByChallengeAndUser).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID);
  });

  it("returns the client-safe shape of the request, excluding the access token", async () => {
    mockFindByChallengeAndUser.mockResolvedValue({
      uuid: "req-1",
      status: "ready",
      requested_at: "2026-01-01T00:00:00.000Z",
      approved_at: "2026-01-02T00:00:00.000Z",
      expires_at: "2026-01-03T00:00:00.000Z",
      ready_at: "2026-01-02T01:00:00.000Z",
      expired_at: null,
      error_message: null,
      access_token_enc: "should-not-leak",
      access_token_iv: "should-not-leak",
    });

    expect(await ownRequest(ctx())).toEqual({
      request: {
        id: "req-1",
        status: "ready",
        requested_at: "2026-01-01T00:00:00.000Z",
        approved_at: "2026-01-02T00:00:00.000Z",
        expires_at: "2026-01-03T00:00:00.000Z",
        ready_at: "2026-01-02T01:00:00.000Z",
        expired_at: null,
        error_message: null,
      },
    });
  });
});

describe("POST request", () => {
  it("creates the compute request and returns 201", async () => {
    mockRequestCompute.mockResolvedValue({
      request: { uuid: "req-1", status: "pending", requested_at: null, approved_at: null, expires_at: null, ready_at: null, expired_at: null, error_message: null },
    });

    const { status, body } = await read(await requestCompute(ctx({ method: "POST" })));

    expect(status).toBe(201);
    expect(mockRequestCompute).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID);
    expect(body).toMatchObject({ request: { id: "req-1", status: "pending" } });
  });

  it("returns 409 when the user already has an active request", async () => {
    mockRequestCompute.mockResolvedValue({ error: "already_requested" });

    expect(await read(await requestCompute(ctx({ method: "POST" })))).toEqual({ status: 409, body: { error: "already_requested" } });
  });

  it.each(["not_ml_challenge", "compute_not_enabled", "scaleway_not_connected"] as const)(
    'returns 400 for business error "%s"',
    async (error) => {
      mockRequestCompute.mockResolvedValue({ error });

      expect(await read(await requestCompute(ctx({ method: "POST" })))).toEqual({ status: 400, body: { error } });
    },
  );
});

describe("POST request/reveal-token", () => {
  it("returns 404 when the user has no compute request on this challenge", async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    expect(await read(await revealToken(ctx({ method: "POST" })))).toEqual({ status: 404, body: { error: "Compute request not found" } });
    expect(mockRevealToken).not.toHaveBeenCalled();
  });

  it("returns 404 when the compute request belongs to someone else", async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: "req-1", user_id: "other-user" });

    expect((await read(await revealToken(ctx({ method: "POST" })))).status).toBe(404);
    expect(mockRevealToken).not.toHaveBeenCalled();
  });

  it("reveals the token for the owning contributor", async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: "req-1", user_id: USER_ID });
    mockRevealToken.mockResolvedValue({ token: "secret-token", jupyterUrl: "http://jupyter.example" });

    expect(await revealToken(ctx({ method: "POST" }))).toEqual({ token: "secret-token", jupyter_url: "http://jupyter.example" });
    expect(mockRevealToken).toHaveBeenCalledWith("req-1", USER_ID);
  });

  it("returns 400 with the service error message when revealing fails", async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: "req-1", user_id: USER_ID });
    mockRevealToken.mockRejectedValue(new Error('Cannot reveal token for a request in status "pending"'));

    expect(await read(await revealToken(ctx({ method: "POST" })))).toEqual({
      status: 400,
      body: { error: 'Cannot reveal token for a request in status "pending"' },
    });
  });

  it("falls back to a default message when the thrown error has none", async () => {
    mockFindByChallengeAndUser.mockResolvedValue({ uuid: "req-1", user_id: USER_ID });
    mockRevealToken.mockRejectedValue({});

    expect(await read(await revealToken(ctx({ method: "POST" })))).toEqual({ status: 400, body: { error: "Failed to reveal token" } });
  });
});

describe("GET requests", () => {
  it("lists the requests, resolving requester names and never leaking the access token", async () => {
    mockFindByChallenge.mockResolvedValue([
      {
        uuid: "req-1", user_id: "user-a", status: "ready",
        requested_at: "2026-01-01T00:00:00.000Z", decided_at: "2026-01-01T01:00:00.000Z",
        approved_at: "2026-01-01T01:00:00.000Z", expires_at: "2026-01-02T01:00:00.000Z",
        error_message: null, access_token_enc: "should-not-leak",
      },
      {
        uuid: "req-2", user_id: "user-b", status: "pending",
        requested_at: "2026-01-03T00:00:00.000Z", decided_at: null, approved_at: null, expires_at: null, error_message: null,
      },
    ]);
    mockFindByIds.mockResolvedValue([
      { uuid: "user-a", full_name: "Ada Lovelace" },
      { uuid: "user-b", full_name: "Grace Hopper" },
    ]);

    const result = await listRequests(ctx());

    expect(mockFindByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockFindByIds).toHaveBeenCalledWith(["user-a", "user-b"]);
    expect(result).toEqual({
      requests: [
        {
          id: "req-1", requesterName: "Ada Lovelace", status: "ready",
          requested_at: "2026-01-01T00:00:00.000Z", decided_at: "2026-01-01T01:00:00.000Z",
          approved_at: "2026-01-01T01:00:00.000Z", expires_at: "2026-01-02T01:00:00.000Z", error_message: null,
        },
        {
          id: "req-2", requesterName: "Grace Hopper", status: "pending",
          requested_at: "2026-01-03T00:00:00.000Z", decided_at: null, approved_at: null, expires_at: null, error_message: null,
        },
      ],
    });
  });

  it('falls back to "Unknown" when the requester cannot be resolved', async () => {
    mockFindByChallenge.mockResolvedValue([
      { uuid: "req-1", user_id: "ghost-user", status: "pending", requested_at: null, decided_at: null, approved_at: null, expires_at: null, error_message: null },
    ]);
    mockFindByIds.mockResolvedValue([]);

    const result = (await listRequests(ctx())) as { requests: Array<{ requesterName: string }> };

    expect(result.requests[0].requesterName).toBe("Unknown");
  });
});

describe("POST requests/:requestId/decision", () => {
  const decision = (body: unknown) =>
    decide(ctx({ method: "POST", body, params: { requestId: "req-1" }, user: { id: USER_ID, role: "admin" } }));

  it("returns 400 for an invalid JSON body", async () => {
    expect(await read(await decision("not-json"))).toEqual({ status: 400, body: { error: "Invalid JSON" } });
  });

  it("approves the request", async () => {
    mockDecide.mockResolvedValue({ status: "approved" });

    expect(await decision({ decision: "approve" })).toEqual({ status: "approved" });
    expect(mockDecide).toHaveBeenCalledWith("req-1", USER_ID, "approve");
  });

  it("rejects the request", async () => {
    mockDecide.mockResolvedValue({ status: "rejected" });

    expect(await decision({ decision: "reject" })).toEqual({ status: "rejected" });
    expect(mockDecide).toHaveBeenCalledWith("req-1", USER_ID, "reject");
  });

  it('retries provisioning for a "retry" decision', async () => {
    mockRetryProvisioning.mockResolvedValue(undefined);

    expect(await decision({ decision: "retry" })).toEqual({ status: "provisioning" });
    expect(mockRetryProvisioning).toHaveBeenCalledWith("req-1");
  });

  it("returns 400 for an unknown decision value", async () => {
    expect(await read(await decision({ decision: "cancel" }))).toEqual({
      status: 400,
      body: { error: 'decision must be "approve", "reject" or "retry"' },
    });
  });

  it("returns 400 with the service error message when the decision fails", async () => {
    mockDecide.mockRejectedValue(new Error('Cannot decide a request in status "ready"'));

    expect(await read(await decision({ decision: "approve" }))).toEqual({
      status: 400,
      body: { error: 'Cannot decide a request in status "ready"' },
    });
  });

  it("falls back to a default message when the thrown error has none", async () => {
    mockDecide.mockRejectedValue({});

    expect(await read(await decision({ decision: "approve" }))).toEqual({ status: 400, body: { error: "Failed to process decision" } });
  });
});
