import { describe, it, expect } from "vitest";
import { z } from "zod";
import { relayScenarioError, scenarioErrorResponse } from "./errors.js";
import {
  ScenarioModeError,
  ScenarioFrozenError,
  EmptyScenarioError,
  StepNotFoundError,
  RunNotFoundError,
  ForbiddenRunAccessError,
  SelfWalkthroughError,
  RunAlreadyCompletedError,
  GlobalFeedbackRequiredError,
  MedicalCommentForbiddenError,
  TargetNotExposedError,
  IncompleteWalkthroughError,
  ValidatorRoleError,
} from "../../../../packages/services/challenge/scenario-errors.js";

// Toutes les actions du parcours s'accordent sur ce tableau erreur -> statut
// HTTP. Une classe non testée ici est une classe où un 403/404 transposé
// serait invisible.
describe("scenarioErrorResponse", () => {
  it("maps IncompleteWalkthroughError to 400 with missingStepIds in the body", async () => {
    const res = scenarioErrorResponse(new IncompleteWalkthroughError("2 steps still have no result", ["step-1", "step-2"]));

    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    expect(await res!.json()).toEqual({ error: "2 steps still have no result", missingStepIds: ["step-1", "step-2"] });
  });

  it("maps SelfWalkthroughError to 403", async () => {
    const res = scenarioErrorResponse(new SelfWalkthroughError("nope"));
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe("nope");
  });

  it.each([
    [ForbiddenRunAccessError, 403],
    [MedicalCommentForbiddenError, 403],
    [ValidatorRoleError, 403],
    [RunNotFoundError, 404],
    [StepNotFoundError, 404],
    [RunAlreadyCompletedError, 409],
    [ScenarioFrozenError, 409],
    [GlobalFeedbackRequiredError, 400],
    [EmptyScenarioError, 400],
    [TargetNotExposedError, 400],
    [ScenarioModeError, 400],
  ] as const)("maps %o to %i", (ErrorClass, status) => {
    expect(scenarioErrorResponse(new ErrorClass("nope"))!.status).toBe(status);
  });

  it("returns null for an error that is not one of the scenario error classes", () => {
    expect(scenarioErrorResponse(new Error("db down"))).toBeNull();
  });
});

describe("relayScenarioError", () => {
  it("answers 400 with the issues for an invalid body", async () => {
    const parsed = z.object({ title: z.string() }).safeParse({});
    const res = relayScenarioError(parsed.error, "An overall feedback is required");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("An overall feedback is required");
  });

  it("rethrows an unexpected error, which the dispatcher relays as a 500", () => {
    expect(() => relayScenarioError(new Error("db down"))).toThrow("db down");
  });
});
