import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  service: { openWalkthrough: vi.fn(), saveStepFeedback: vi.fn(), completeWalkthrough: vi.fn() },
  contributionRepo: { findById: vi.fn() },
  userRepo: { findByIds: vi.fn() },
  stepRepo: { findByChallenge: vi.fn() },
  runRepo: { findByChallenge: vi.fn() },
  feedbackRepo: { findByRuns: vi.fn() },
  qualificationRepo: { findHolders: vi.fn() },
}));

vi.mock("../../../../packages/services/challenge/scenario-walkthrough.service.js", () => ({
  ScenarioWalkthroughService: class {
    constructor() {
      return h.service;
    }
  },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ContributionRepository: class {
    constructor() {
      return h.contributionRepo;
    }
  },
  UserRepository: class {
    constructor() {
      return h.userRepo;
    }
  },
  ScenarioStepRepository: class {
    constructor() {
      return h.stepRepo;
    }
  },
  ScenarioRunRepository: class {
    constructor() {
      return h.runRepo;
    }
  },
  StepFeedbackRepository: class {
    constructor() {
      return h.feedbackRepo;
    }
  },
  UserQualificationRepository: class {
    constructor() {
      return h.qualificationRepo;
    }
  },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import {
  EmptyScenarioError,
  ForbiddenRunAccessError,
  IncompleteWalkthroughError,
  MedicalCommentForbiddenError,
  RunAlreadyCompletedError,
  SelfWalkthroughError,
  TargetNotExposedError,
} from "../../../../packages/services/challenge/scenario-errors.js";
import { completeRun, listRuns, openRun, saveStep } from "./runs.js";
import { journeyValidationFlow } from "../index.js";

const CHALLENGE_ID = "vch-1";
const APP = "11111111-1111-4111-8111-111111111111";
const APP_B = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "run-1";
const STEP_ID = "step-1";

const ctx = (options: Parameters<typeof actionContext>[0] = {}) =>
  actionContext({
    challenge: {
      uuid: CHALLENGE_ID,
      type: "journey-validation",
      source_challenge_id: "code-ch-1",
      flow_config: { cp_per_validation: 200, eligible_roles: ["contributor", "admin"], expert_comment_qualification: "medical_pro" },
    },
    user: { id: "bob" },
    ...options,
  });

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("journey-validation — declared access of the walkthroughs", () => {
  const access = (method: string, path: string) =>
    journeyValidationFlow.actions?.find((a) => a.method === method && a.path === path)?.access;

  it("lets any signed-in principal walk through, the service refining eligibility", () => {
    expect(access("POST", "scenario-runs")).toEqual({});
    expect(access("PUT", "scenario-runs/:runId/steps/:stepId")).toEqual({});
    expect(access("POST", "scenario-runs/:runId/complete")).toEqual({});
  });

  it("keeps the signed feedback of every validator to an admin or the challenge's manager", () => {
    // Contrairement à la liste des cibles, que tout contributeur doit lire,
    // cette vue expose le retour signé de tous les autres validateurs.
    expect(access("GET", "scenario-runs")).toEqual({ roles: ["admin"], manager: true });
  });
});

describe("POST scenario-runs", () => {
  beforeEach(() => {
    h.service.openWalkthrough.mockResolvedValue({
      runId: RUN_ID, contributionId: APP, completedAt: null, globalFeedback: null,
      steps: [{ stepId: STEP_ID, position: 0, title: "Create an account", instructions: null, result: null, comment: null, medicalComment: null }],
    });
  });

  it("opens a walkthrough for the caller", async () => {
    const { status, body } = await read(await openRun(ctx({ body: { contribution_id: APP } })));

    expect(status).toBe(200);
    expect(body.runId).toBe(RUN_ID);
    expect(h.service.openWalkthrough).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, contributionId: APP, validatorUserId: "bob",
    });
  });

  it("rejects a body with no contribution_id", async () => {
    expect((await read(await openRun(ctx({ body: {} })))).status).toBe(400);
    expect(h.service.openWalkthrough).not.toHaveBeenCalled();
  });

  it("returns 403 on my own application", async () => {
    h.service.openWalkthrough.mockRejectedValue(new SelfWalkthroughError("own"));

    expect((await read(await openRun(ctx({ body: { contribution_id: APP } })))).status).toBe(403);
  });

  it("returns 400 when the application is not exposed here", async () => {
    h.service.openWalkthrough.mockRejectedValue(new TargetNotExposedError("nope"));

    expect((await read(await openRun(ctx({ body: { contribution_id: APP } })))).status).toBe(400);
  });

  it("returns 400 when no scenario step has been written yet", async () => {
    h.service.openWalkthrough.mockRejectedValue(new EmptyScenarioError("empty"));

    expect((await read(await openRun(ctx({ body: { contribution_id: APP } })))).status).toBe(400);
  });
});

describe("GET scenario-runs", () => {
  beforeEach(() => {
    h.stepRepo.findByChallenge.mockResolvedValue([
      { uuid: "step-1", position: 0, title: "Create an account" },
      { uuid: "step-2", position: 1, title: "Log in" },
    ]);
    h.runRepo.findByChallenge.mockResolvedValue([
      { uuid: "run-1", contribution_id: APP, validator_user_id: "bob", completed_at: new Date("2026-09-08"), global_feedback: "Usable end to end." },
      { uuid: "run-2", contribution_id: APP_B, validator_user_id: "carol", completed_at: null, global_feedback: null },
    ]);
    h.qualificationRepo.findHolders.mockResolvedValue(["bob"]);
    h.feedbackRepo.findByRuns.mockResolvedValue([
      { uuid: "fb-2", run_id: "run-1", step_id: "step-2", result: "failed", comment: "Login loops.", medical_comment: "Not usable in consultation." },
      { uuid: "fb-1", run_id: "run-1", step_id: "step-1", result: "passed", comment: null, medical_comment: null },
      { uuid: "fb-3", run_id: "run-2", step_id: "step-1", result: "blocked", comment: null, medical_comment: null },
    ]);
    h.contributionRepo.findById.mockImplementation(async (id: string) => ({
      uuid: id, user_id: id === APP ? "alice" : "dan", live_endpoint_url: `https://${id}.example.com`,
    }));
    h.userRepo.findByIds.mockResolvedValue([
      { uuid: "alice", full_name: "Alice" }, { uuid: "dan", full_name: "Dan" },
      { uuid: "bob", full_name: "Bob", role: "contributor" }, { uuid: "carol", full_name: "Carol", role: "contributor" },
    ]);
  });

  const runs = async () => (await listRuns(ctx({ user: { id: "admin-1", role: "admin" } }))) as any;

  it("returns every walkthrough with its step results, comments and expert opinions", async () => {
    const body = await runs();

    expect(body.runs).toHaveLength(2);
    expect(h.qualificationRepo.findHolders).toHaveBeenCalledWith(["bob", "carol"], "medical_pro");
    expect(body.runs[1]).toMatchObject({ isExpert: false });
    expect(body.runs[0]).toMatchObject({
      id: "run-1", validatorName: "Bob", isExpert: true, expertLabel: "Health professional",
      submitterName: "Alice", globalFeedback: "Usable end to end.", answeredCount: 2,
    });
  });

  it("flags no expert when the journey asks for no expert opinion", async () => {
    const body = (await listRuns(
      ctx({ challenge: { uuid: CHALLENGE_ID, type: "journey-validation", flow_config: { eligible_roles: ["contributor"], expert_comment_qualification: null } } }),
    )) as any;

    expect(h.qualificationRepo.findHolders).not.toHaveBeenCalled();
    expect(body.runs[0]).toMatchObject({ isExpert: false, expertLabel: null });
  });

  it("orders step feedbacks by scenario position, not by insertion order", async () => {
    // Le panneau rend une ligne de marques P/F/B : dans l'ordre d'insertion,
    // elle ne correspondrait pas aux étapes qu'elle prétend résumer.
    const body = await runs();

    expect(body.runs[0].stepFeedbacks.map((f: any) => f.stepId)).toEqual(["step-1", "step-2"]);
  });

  it("ships the scenario so the panel can label the marks without a second request", async () => {
    expect((await runs()).steps).toEqual([
      { id: "step-1", position: 0, title: "Create an account" },
      { id: "step-2", position: 1, title: "Log in" },
    ]);
  });

  it("reports a draft with a null completedAt and a partial answered count", async () => {
    expect((await runs()).runs[1]).toMatchObject({ completedAt: null, answeredCount: 1 });
  });
});

describe("PUT scenario-runs/:runId/steps/:stepId", () => {
  const put = (body: unknown) => saveStep(ctx({ method: "PUT", body, params: { runId: RUN_ID, stepId: STEP_ID } }));

  beforeEach(() => {
    h.service.saveStepFeedback.mockResolvedValue({
      runId: RUN_ID, contributionId: "app-1", completedAt: null, globalFeedback: null,
      steps: [{ stepId: STEP_ID, position: 0, title: "Create an account", instructions: null, result: "passed", comment: null, medicalComment: null }],
    });
  });

  it("saves a result and returns the whole walkthrough state", async () => {
    const { status, body } = await read(await put({ result: "passed" }));

    expect(status).toBe(200);
    expect(body.runId).toBe(RUN_ID);
    expect(h.service.saveStepFeedback).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, runId: RUN_ID, stepId: STEP_ID, validatorUserId: "bob",
      result: "passed", comment: null, medicalComment: null,
    });
  });

  it("carries both the comment and the medical comment", async () => {
    await put({
      result: "failed",
      comment: "The PDF opens blank.",
      medical_comment: "A measurement without its unit is not a clinical record.",
    });

    expect(h.service.saveStepFeedback).toHaveBeenCalledWith(expect.objectContaining({
      comment: "The PDF opens blank.",
      medicalComment: "A measurement without its unit is not a clinical record.",
    }));
  });

  it("rejects a result outside passed/failed/blocked", async () => {
    expect((await read(await put({ result: "maybe" }))).status).toBe(400);
  });

  it("returns 403 when a validator without the expert qualification sends a medical comment", async () => {
    h.service.saveStepFeedback.mockRejectedValue(new MedicalCommentForbiddenError("no"));

    expect((await read(await put({ result: "passed", medical_comment: "Unsafe." }))).status).toBe(403);
  });

  it("returns 409 on a completed walkthrough", async () => {
    h.service.saveStepFeedback.mockRejectedValue(new RunAlreadyCompletedError("done"));

    expect((await read(await put({ result: "passed" }))).status).toBe(409);
  });

  it("returns 403 on someone else's walkthrough", async () => {
    h.service.saveStepFeedback.mockRejectedValue(new ForbiddenRunAccessError("not yours"));

    expect((await read(await put({ result: "passed" }))).status).toBe(403);
  });
});

describe("POST scenario-runs/:runId/complete", () => {
  const complete = (body: unknown) => completeRun(ctx({ body, params: { runId: RUN_ID } }));

  it("completes the walkthrough and reports the CP awarded", async () => {
    h.service.completeWalkthrough.mockResolvedValue({ completed: true, cpAwarded: 200 });

    expect(await complete({ global_feedback: "Usable end to end." })).toEqual({ completed: true, cpAwarded: 200 });
    expect(h.service.completeWalkthrough).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, runId: RUN_ID, validatorUserId: "bob", globalFeedback: "Usable end to end.",
    });
  });

  it("rejects an empty overall feedback before it reaches the service", async () => {
    const { status, body } = await read(await complete({ global_feedback: "   " }));

    expect(status).toBe(400);
    expect(body.error).toBe("An overall feedback is required");
    expect(h.service.completeWalkthrough).not.toHaveBeenCalled();
  });

  it("returns the unanswered step ids so the client can point at them", async () => {
    h.service.completeWalkthrough.mockRejectedValue(
      new IncompleteWalkthroughError("2 steps still have no result", ["step-3", "step-5"]),
    );

    const { status, body } = await read(await complete({ global_feedback: "Done." }));

    expect(status).toBe(400);
    expect(body).toEqual({ error: "2 steps still have no result", missingStepIds: ["step-3", "step-5"] });
  });

  it("returns 409 on an already-completed walkthrough", async () => {
    h.service.completeWalkthrough.mockRejectedValue(new RunAlreadyCompletedError("done"));

    expect((await read(await complete({ global_feedback: "Done." }))).status).toBe(409);
  });

  it("returns 403 when the application turns out to be my own group's", async () => {
    h.service.completeWalkthrough.mockRejectedValue(new SelfWalkthroughError("own"));

    expect((await read(await complete({ global_feedback: "Done." }))).status).toBe(403);
  });
});
