import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  service: { castVerdict: vi.fn() },
  errors: {
    SelfVoteError: class extends Error {},
    DuplicateVerdictError: class extends Error {},
    ValidationTargetError: class extends Error {},
    InsufficientRoleError: class extends Error {},
    ClaimNotFoundError: class extends Error {},
    ForbiddenClaimAccessError: class extends Error {},
    ClaimNotRevealedError: class extends Error {},
  },
}));

vi.mock("../../../../packages/services/challenge/validation-challenge.service.js", () => ({
  ValidationChallengeService: class { constructor() { return h.service; } },
  ...h.errors,
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { endpointValidationActions } from "./index.js";
import { castVerdict } from "./verdicts.js";

const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const CHALLENGE = {
  uuid: "challenge-1", type: "endpoint-validation",
  flow_config: { cp_per_validation: 5, required_validations: 3, reviewer_qualification: "medical_pro" },
};

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    contribution_id: "11111111-1111-4111-8111-111111111111",
    verdict: "works",
    description: "Looks correct on the sample input",
    reference_case_claim_id: CLAIM_ID,
    ...overrides,
  };
}

const cast = (body: unknown = baseBody()) =>
  castVerdict(actionContext({ challenge: CHALLENGE, user: { id: "user-1" }, method: "POST", body }));

async function statusOf(result: unknown): Promise<number> {
  return result instanceof Response ? result.status : 200;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST verdicts", () => {
  it("is kept to holders of the reviewer qualification the challenge requires", () => {
    const access = endpointValidationActions.find((a) => a.method === "POST" && a.path === "verdicts")?.access;

    expect(Object.keys(access ?? {})).toEqual(["qualification"]);
    expect(access?.qualification?.(CHALLENGE as never)).toBe("medical_pro");
  });

  it("forwards the verdict, description, and claim id to the service", async () => {
    const outcome = { verdictRecorded: true, resolved: false, outcome: "pending", verdictCount: 1, requiredValidations: 3, cpAwarded: 0 };
    h.service.castVerdict.mockResolvedValue(outcome);

    expect(await cast()).toEqual(outcome);
    expect(h.service.castVerdict).toHaveBeenCalledWith({
      validationChallengeId: "challenge-1",
      contributionId: "11111111-1111-4111-8111-111111111111",
      validatorUserId: "user-1",
      verdict: "works",
      description: "Looks correct on the sample input",
      referenceCaseClaimId: CLAIM_ID,
    });
  });

  it.each([
    ["a works verdict with no description", baseBody({ description: "" })],
    ["a broken verdict with no description", baseBody({ verdict: "broken", description: "" })],
    ["an invalid contribution_id", baseBody({ contribution_id: "not-a-uuid" })],
    ["a missing reference_case_claim_id", baseBody({ reference_case_claim_id: undefined })],
  ])("rejects %s", async (_label, body) => {
    expect(await statusOf(await cast(body))).toBe(400);
    expect(h.service.castVerdict).not.toHaveBeenCalled();
  });

  it.each([
    ["InsufficientRoleError", 403],
    ["SelfVoteError", 403],
    ["ForbiddenClaimAccessError", 403],
    ["DuplicateVerdictError", 409],
    ["ClaimNotFoundError", 404],
    ["ClaimNotRevealedError", 400],
    ["ValidationTargetError", 400],
  ] as const)("maps %s to %i", async (name, status) => {
    h.service.castVerdict.mockRejectedValue(new h.errors[name]("refused"));

    expect(await statusOf(await cast())).toBe(status);
  });

  it("lets an unknown error reach the dispatcher, which answers 500", async () => {
    h.service.castVerdict.mockRejectedValue(new Error("boom"));

    await expect(cast()).rejects.toThrow("boom");
  });
});
