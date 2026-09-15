import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  targetRepo: { findById: vi.fn() },
  caseRepo: { isPurged: vi.fn() },
  caseClaimRepo: { findByValidatorAndTarget: vi.fn(), findPurgeState: vi.fn() },
  service: { claimCase: vi.fn(), listClaimableCases: vi.fn(), recordObservation: vi.fn(), revealExpectedOutput: vi.fn() },
  errors: {
    ValidationTargetError: class extends Error {},
    SelfVoteError: class extends Error {},
    InsufficientRoleError: class extends Error {},
    SelfAuthoredCaseError: class extends Error {},
    DuplicateClaimError: class extends Error {},
    EndpointCallError: class extends Error {},
    ClaimNotFoundError: class extends Error {},
    ForbiddenClaimAccessError: class extends Error {},
    ObservationAlreadyRecordedError: class extends Error {},
    ObservationRequiredError: class extends Error {},
  },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ValidationTargetRepository: class { constructor() { return h.targetRepo; } },
  ReferenceCaseRepository: class { constructor() { return h.caseRepo; } },
  CaseClaimRepository: class { constructor() { return h.caseClaimRepo; } },
}));

vi.mock("../../../../packages/services/challenge/reference-case.service.js", () => ({
  ReferenceCaseService: class { constructor() { return h.service; } },
  ...h.errors,
}));

import { actionContext, type ActionContextOptions } from "../../../../packages/capabilities/testing/action-context.js";
import { endpointValidationActions } from "./index.js";
import { claimCase, claimableCases, recordObservation, revealExpectedOutput } from "./claims.js";

const CASE_ID = "33333333-3333-4333-8333-333333333333";
const CHALLENGE = {
  uuid: "challenge-1", type: "endpoint-validation",
  flow_config: { cp_per_validation: 5, required_validations: 3, reviewer_qualification: "medical_pro" },
};

const ctx = (options: ActionContextOptions = {}) =>
  actionContext({ challenge: CHALLENGE, user: { id: "bob", role: "contributor" }, method: "POST", ...options });

async function statusOf(result: unknown): Promise<number> {
  return result instanceof Response ? result.status : 200;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: "challenge-1", contribution_id: "contrib-1" });
  h.caseRepo.isPurged.mockResolvedValue(false);
  h.caseClaimRepo.findByValidatorAndTarget.mockResolvedValue([]);
  h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "bob", claim_purged_at: null, case_purged_at: null });
});

describe("endpoint validation — declared access", () => {
  const access = (method: string, path: string) =>
    endpointValidationActions.find((a) => a.method === method && a.path === path)?.access;

  it.each([
    ["POST", "targets/:targetId/claim"],
    ["GET", "targets/:targetId/claimable-cases"],
    ["POST", "case-claims/:claimId/observation"],
    ["POST", "case-claims/:claimId/reveal"],
  ])("keeps %s %s to holders of the reviewer qualification the challenge requires", (method, path) => {
    const qualification = access(method, path)?.qualification;

    expect(qualification?.(CHALLENGE as never)).toBe("medical_pro");
    expect(Object.keys(access(method, path) ?? {})).toEqual(["qualification"]);
  });
});

describe("POST targets/:targetId/claim", () => {
  const claim = (body: unknown = { reference_case_id: CASE_ID }) => claimCase(ctx({ body, params: { targetId: "target-1" } }));

  it("returns the live response bytes with a claim id header on success", async () => {
    h.service.claimCase.mockResolvedValue({
      claim: { uuid: "claim-1" },
      liveResponse: { status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') },
    });

    const res = (await claim()) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("x-claim-id")).toBe("claim-1");
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.text()).toBe('{"label":"cat"}');
    expect(h.service.claimCase).toHaveBeenCalledWith({
      validationChallengeId: "challenge-1", contributionId: "contrib-1", referenceCaseId: CASE_ID, validatorUserId: "bob",
    });
  });

  it("never copies the endpoint's Content-Type blindly — nosniff, and HTML is forced to download", async () => {
    h.service.claimCase.mockResolvedValue({
      claim: { uuid: "claim-1" },
      liveResponse: { status: 200, contentType: "text/html; charset=utf-8", body: Buffer.from("<script>alert(1)</script>") },
    });

    const res = (await claim()) as Response;

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("x-validation-status")).toBe("200");
  });

  it("returns 410 when the reference case was purged by the retention job", async () => {
    h.caseRepo.isPurged.mockResolvedValue(true);

    expect(await statusOf(await claim())).toBe(410);
    expect(h.service.claimCase).not.toHaveBeenCalled();
  });

  it("returns 404 when the target does not belong to this challenge", async () => {
    h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: "other-challenge", contribution_id: "contrib-1" });

    expect(await statusOf(await claim())).toBe(404);
    expect(h.service.claimCase).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid reference_case_id", async () => {
    expect(await statusOf(await claim({ reference_case_id: "not-a-uuid" }))).toBe(400);
    expect(h.service.claimCase).not.toHaveBeenCalled();
  });

  it.each([
    ["InsufficientRoleError", 403],
    ["SelfAuthoredCaseError", 403],
    ["SelfVoteError", 403],
    ["ValidationTargetError", 400],
    ["DuplicateClaimError", 409],
    ["EndpointCallError", 502],
  ] as const)("maps %s to %i", async (name, status) => {
    h.service.claimCase.mockRejectedValue(new h.errors[name]("refused"));

    expect(await statusOf(await claim())).toBe(status);
  });

  it("lets an unexpected error reach the dispatcher", async () => {
    h.service.claimCase.mockRejectedValue(new Error("boom"));

    await expect(claim()).rejects.toThrow("boom");
  });
});

describe("GET targets/:targetId/claimable-cases", () => {
  const list = () => claimableCases(ctx({ method: "GET", params: { targetId: "target-1" } }));

  it("lists claimable cases without their bytes, and my unfinished claims", async () => {
    h.service.listClaimableCases.mockResolvedValue([
      { uuid: "case-1", input_filename: "in.png", input_content_type: "image/png", input_bytes: Buffer.from("x") },
    ]);
    h.caseClaimRepo.findByValidatorAndTarget.mockResolvedValue([
      { uuid: "claim-1", observed_at: new Date(), revealed_at: null },
      { uuid: "claim-2", observed_at: new Date(), revealed_at: new Date() },
    ]);

    expect(await list()).toEqual({
      claimableCases: [{ id: "case-1", inputFilename: "in.png", inputContentType: "image/png" }],
      myOpenClaims: [{ id: "claim-1", observed: true, revealed: false }],
    });
    expect(h.service.listClaimableCases).toHaveBeenCalledWith({
      validationChallengeId: "challenge-1", contributionId: "contrib-1", requestingUserId: "bob",
    });
  });

  it("returns 404 when the target does not belong to this challenge", async () => {
    h.targetRepo.findById.mockResolvedValue(null);

    expect(await statusOf(await list())).toBe(404);
  });
});

describe("POST case-claims/:claimId/observation", () => {
  const observe = (body: unknown = { observation: "Looks correct" }) =>
    recordObservation(ctx({ body, params: { claimId: "claim-1" } }));

  it("records the observation on success", async () => {
    h.service.recordObservation.mockResolvedValue({ uuid: "claim-1", observed_at: new Date() });

    expect(await observe()).toEqual({ ok: true });
    expect(h.service.recordObservation).toHaveBeenCalledWith({ claimId: "claim-1", validatorUserId: "bob", observation: "Looks correct" });
  });

  it("returns 400 for an empty observation", async () => {
    expect(await statusOf(await observe({ observation: "" }))).toBe(400);
    expect(h.service.recordObservation).not.toHaveBeenCalled();
  });

  it.each([
    ["ClaimNotFoundError", 404],
    ["ForbiddenClaimAccessError", 403],
    ["ObservationAlreadyRecordedError", 409],
  ] as const)("maps %s to %i", async (name, status) => {
    h.service.recordObservation.mockRejectedValue(new h.errors[name]("refused"));

    expect(await statusOf(await observe())).toBe(status);
  });
});

describe("POST case-claims/:claimId/reveal", () => {
  const reveal = () => revealExpectedOutput(ctx({ params: { claimId: "claim-1" } }));

  it("returns the expected output bytes on success", async () => {
    h.service.revealExpectedOutput.mockResolvedValue({ contentType: "application/json", filename: null, body: Buffer.from('{"label":"cat"}') });

    const res = (await reveal()) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.text()).toBe('{"label":"cat"}');
  });

  it.each([
    ["ClaimNotFoundError", 404],
    ["ForbiddenClaimAccessError", 403],
    // L'ordre observation puis révélation est imposé ici aussi, pas seulement dans le service.
    ["ObservationRequiredError", 400],
  ] as const)("maps %s to %i", async (name, status) => {
    h.service.revealExpectedOutput.mockRejectedValue(new h.errors[name]("refused"));

    expect(await statusOf(await reveal())).toBe(status);
  });

  it("returns 410 to the claim owner once the retention purge has run", async () => {
    h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "bob", claim_purged_at: new Date(), case_purged_at: new Date() });

    expect(await statusOf(await reveal())).toBe(410);
    expect(h.service.revealExpectedOutput).not.toHaveBeenCalled();
  });

  it("does not reveal the purge to someone else — the service answers instead", async () => {
    h.caseClaimRepo.findPurgeState.mockResolvedValue({ validator_user_id: "carol", claim_purged_at: new Date(), case_purged_at: new Date() });
    h.service.revealExpectedOutput.mockRejectedValue(new h.errors.ForbiddenClaimAccessError("not yours"));

    expect(await statusOf(await reveal())).toBe(403);
  });
});
