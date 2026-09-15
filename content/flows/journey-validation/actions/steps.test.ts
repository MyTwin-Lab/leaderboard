import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  service: { listSteps: vi.fn(), isFrozen: vi.fn(), addStep: vi.fn(), editStep: vi.fn(), removeStep: vi.fn() },
}));

vi.mock("../../../../packages/services/challenge/scenario-steps.service.js", () => ({
  ScenarioStepsService: class {
    constructor() {
      return h.service;
    }
  },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { ScenarioFrozenError, ScenarioModeError, StepNotFoundError } from "../../../../packages/services/challenge/scenario-errors.js";
import { addStep, editStep, listSteps, removeStep } from "./steps.js";
import { journeyValidationFlow } from "../index.js";

const CHALLENGE_ID = "vch-1";
const STEP_ID = "step-1";

const ctx = (options: Parameters<typeof actionContext>[0] = {}) =>
  actionContext({ challenge: { uuid: CHALLENGE_ID, type: "journey-validation" }, ...options });

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.service.listSteps.mockResolvedValue([
    { uuid: "step-1", position: 0, title: "Create an account", instructions: "Sign up with an email address." },
  ]);
  h.service.isFrozen.mockResolvedValue(false);
  h.service.addStep.mockResolvedValue({ uuid: "step-new", position: 1, title: "Log in", instructions: null });
  h.service.editStep.mockResolvedValue({ uuid: STEP_ID, position: 0, title: "Sign up", instructions: null });
  h.service.removeStep.mockResolvedValue(undefined);
});

describe("journey-validation — declared access of the scenario", () => {
  const access = (method: string, path: string) =>
    journeyValidationFlow.actions?.find((a) => a.method === method && a.path === path)?.access;

  it("serves the scenario to any signed-in contributor", () => {
    expect(access("GET", "scenario-steps")).toEqual({});
  });

  it("keeps writing the scenario to an admin or the challenge's manager", () => {
    const managers = { roles: ["admin"], manager: true };
    expect(access("POST", "scenario-steps")).toEqual(managers);
    expect(access("PATCH", "scenario-steps/:stepId")).toEqual(managers);
    expect(access("DELETE", "scenario-steps/:stepId")).toEqual(managers);
  });
});

describe("GET scenario-steps", () => {
  it("serves the scenario in wire shape", async () => {
    // Le scénario est le protocole, pas un secret : contrairement à la sortie
    // attendue d'un cas de référence, rien n'est caché au validateur.
    const { body } = await read(await listSteps(ctx()));

    expect(body.steps).toEqual([
      { id: "step-1", position: 0, title: "Create an account", instructions: "Sign up with an email address." },
    ]);
    expect(h.service.listSteps).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it("reports the freeze so the editor can render read-only without trying a write first", async () => {
    h.service.isFrozen.mockResolvedValue(true);

    expect((await read(await listSteps(ctx()))).body.frozen).toBe(true);
  });

  it("returns 400 when the service refuses the challenge", async () => {
    h.service.listSteps.mockRejectedValue(new ScenarioModeError("nope"));

    expect((await read(await listSteps(ctx()))).status).toBe(400);
  });
});

describe("POST scenario-steps", () => {
  it("adds a step", async () => {
    const { status, body } = await read(await addStep(ctx({ body: { title: "Log in" } })));

    expect(status).toBe(201);
    expect(body).toEqual({ id: "step-new", position: 1, title: "Log in", instructions: null });
    expect(h.service.addStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, title: "Log in", instructions: null });
  });

  it("rejects an empty title", async () => {
    expect((await read(await addStep(ctx({ body: { title: "   " } })))).status).toBe(400);
    expect(h.service.addStep).not.toHaveBeenCalled();
  });

  it("returns 409 once a walkthrough exists", async () => {
    h.service.addStep.mockRejectedValue(new ScenarioFrozenError("frozen"));

    expect((await read(await addStep(ctx({ body: { title: "Late step" } })))).status).toBe(409);
  });
});

describe("PATCH scenario-steps/:stepId", () => {
  const patch = (body: unknown) => editStep(ctx({ method: "PATCH", body, params: { stepId: STEP_ID } }));

  it("renames a step", async () => {
    const { status, body } = await read(await patch({ title: "Sign up" }));

    expect(status).toBe(200);
    expect(body).toEqual({ id: STEP_ID, position: 0, title: "Sign up", instructions: null });
    expect(h.service.editStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, title: "Sign up" });
  });

  it("reorders a step", async () => {
    await patch({ position: 2 });

    expect(h.service.editStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, position: 2 });
  });

  it("clears the instructions when sent an explicit null", async () => {
    // `undefined` veut dire « n'y touche pas », `null` veut dire « vide-le ».
    await patch({ instructions: null });

    expect(h.service.editStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, instructions: null });
  });

  it("rejects a body with nothing to change", async () => {
    expect((await read(await patch({}))).status).toBe(400);
  });

  it("rejects a negative position", async () => {
    expect((await read(await patch({ position: -1 }))).status).toBe(400);
  });

  it("returns 404 for a step on another challenge", async () => {
    h.service.editStep.mockRejectedValue(new StepNotFoundError("nope"));

    expect((await read(await patch({ title: "Sign up" }))).status).toBe(404);
  });

  it("returns 409 once a walkthrough exists", async () => {
    h.service.editStep.mockRejectedValue(new ScenarioFrozenError("frozen"));

    expect((await read(await patch({ title: "Sign up" }))).status).toBe(409);
  });
});

describe("DELETE scenario-steps/:stepId", () => {
  const remove = () => removeStep(ctx({ method: "DELETE", params: { stepId: STEP_ID } }));

  it("deletes a step", async () => {
    expect(await remove()).toEqual({ success: true });
    expect(h.service.removeStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID });
  });

  it("returns 409 once a walkthrough exists", async () => {
    h.service.removeStep.mockRejectedValue(new ScenarioFrozenError("frozen"));

    expect((await read(await remove())).status).toBe(409);
  });
});
