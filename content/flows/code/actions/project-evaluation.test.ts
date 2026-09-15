import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  service: { canEvaluate: vi.fn(), claim: vi.fn(), scheduleRun: vi.fn() },
}));

vi.mock("../../../../packages/services/challenge/code-rewards.service.js", () => ({
  CodeRewardsService: class {
    constructor() {
      return h.service;
    }
  },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { startProjectEvaluation } from "./project-evaluation.js";
import { codeFlow } from "../index.js";

const CHALLENGE_ID = "challenge-1";
const USER_ID = "user-1";

async function post(): Promise<{ status: number; body: any }> {
  const result = await startProjectEvaluation(
    actionContext({ challenge: { uuid: CHALLENGE_ID, type: "code" }, user: { id: USER_ID }, method: "POST" }),
  );
  return { status: result.status, body: await result.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.service.canEvaluate.mockResolvedValue({ ok: true });
  h.service.claim.mockResolvedValue({ ok: true });
});

describe("POST project-evaluation — declared access", () => {
  it("lets any signed-in caller try: the service checks the board and the workspace", () => {
    expect(codeFlow.actions?.find((a) => a.method === "POST" && a.path === "project-evaluation")?.access).toEqual({});
  });
});

describe("POST project-evaluation", () => {
  it("returns 400 with reason when canEvaluate fails with tasks_not_done", async () => {
    h.service.canEvaluate.mockResolvedValue({ ok: false, reason: "tasks_not_done" });

    const { status, body } = await post();

    expect(status).toBe(400);
    expect(body.reason).toBe("tasks_not_done");
    expect(h.service.claim).not.toHaveBeenCalled();
    expect(h.service.scheduleRun).not.toHaveBeenCalled();
  });

  it("returns 409 when canEvaluate fails with already_running", async () => {
    h.service.canEvaluate.mockResolvedValue({ ok: false, reason: "already_running" });

    const { status, body } = await post();

    expect(status).toBe(409);
    expect(body.reason).toBe("already_running");
    expect(h.service.claim).not.toHaveBeenCalled();
  });

  it("returns 409 when the claim loses the race, without scheduling a run", async () => {
    // canEvaluate a lu un statut libre, mais un lancement concurrent a pris le run entre-temps.
    h.service.claim.mockResolvedValue({ ok: false, reason: "already_running" });

    const { status, body } = await post();

    expect(status).toBe(409);
    expect(body.reason).toBe("already_running");
    expect(h.service.scheduleRun).not.toHaveBeenCalled();
  });

  it("schedules only one run for two launches in a row", async () => {
    h.service.claim.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: "already_running" });

    const first = await post();
    const second = await post();

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect(h.service.scheduleRun).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the claim finds no resolvable workspace", async () => {
    h.service.claim.mockResolvedValue({ ok: false, reason: "workspace_not_ready" });

    expect((await post()).status).toBe(400);
    expect(h.service.scheduleRun).not.toHaveBeenCalled();
  });

  it("returns 202 and schedules the run once claimed", async () => {
    const { status, body } = await post();

    expect(status).toBe(202);
    expect(body).toEqual({ scheduled: true });
    expect(h.service.claim).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, userId: USER_ID });
    expect(h.service.scheduleRun).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, userId: USER_ID });
  });
});
