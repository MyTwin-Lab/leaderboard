import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyRequestToken, mockClaim, mockScheduleRun } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockClaim: vi.fn(),
  mockScheduleRun: vi.fn(),
}));

// Comme le vrai helper : `null` sans cookie access_token ; la doublure décide du reste.
vi.mock("@/lib/auth", () => ({
  verifyRequestToken: (req: NextRequest) =>
    req.cookies.get("access_token") ? mockVerifyRequestToken(req) : Promise.resolve(null),
}));

vi.mock("../../../../../../../../packages/services/sandbox", () => ({
  SandboxEvaluationService: class {
    claim = mockClaim;
    scheduleRun = mockScheduleRun;
  },
}));

import { POST } from "./route";

const SANDBOX_ID = "sandbox-1";
const USER_ID = "user-1";

function postEvaluation(token?: string) {
  const req = new NextRequest(`http://localhost/api/sandboxes/${SANDBOX_ID}/evaluation`, {
    method: "POST",
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return POST(req, { params: Promise.resolve({ id: SANDBOX_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: USER_ID, role: "contributor" });
  mockClaim.mockResolvedValue({ ok: true });
});

describe("POST /api/sandboxes/[id]/evaluation", () => {
  it("returns 401 without a session", async () => {
    const res = await postEvaluation();

    expect(res.status).toBe(401);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it("returns 202 and schedules the run once the claim succeeds", async () => {
    const res = await postEvaluation("valid-token");

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ scheduled: true });
    expect(mockClaim).toHaveBeenCalledWith({ sandboxId: SANDBOX_ID, userId: USER_ID });
    expect(mockScheduleRun).toHaveBeenCalledWith({ sandboxId: SANDBOX_ID, userId: USER_ID });
  });

  it("returns 409 on a second launch while the first run is in flight, without scheduling it", async () => {
    mockClaim
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "already_running" });

    const first = await postEvaluation("valid-token");
    const second = await postEvaluation("valid-token");

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect((await second.json()).reason).toBe("already_running");
    expect(mockScheduleRun).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not_found", 404],
    ["not_author", 403],
    ["invalid_repo", 400],
  ])("maps a %s refusal to %i without scheduling", async (reason, status) => {
    mockClaim.mockResolvedValue({ ok: false, reason });

    const res = await postEvaluation("valid-token");

    expect(res.status).toBe(status);
    expect((await res.json()).reason).toBe(reason);
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it("returns 500 when the claim throws", async () => {
    mockClaim.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postEvaluation("valid-token");

    expect(res.status).toBe(500);
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });
});
