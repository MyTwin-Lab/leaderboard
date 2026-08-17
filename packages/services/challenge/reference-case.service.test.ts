import { describe, it, expect, vi, beforeEach } from "vitest";

// assertPublicHttpUrl (called via proxyFileToEndpoint, not through injectable
// deps) does a real DNS lookup — mock it so these tests exercise the
// service's own logic without touching the network, same approach as
// validation-challenge.service.test.ts used to take before challenge-014.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "203.0.113.10", family: 4 }]),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

import {
  ReferenceCaseService,
  InsufficientRoleError,
  ReferenceCaseQuotaError,
  ValidationTargetError,
  SelfVoteError,
  SelfAuthoredCaseError,
  DuplicateClaimError,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ObservationAlreadyRecordedError,
  ObservationRequiredError,
  EndpointCallError,
} from "./reference-case.service.js";
import type { ReferenceCaseDeps } from "./reference-case.service.js";
import type { Challenge, Contribution, ValidationTarget, User, ValidationReferenceCase, ValidationCaseClaim } from "../../database-service/domain/entities.js";

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: "vch-1",
    title: "Validate the sentiment API",
    status: "active",
    type: "validation",
    contribution_points_reward: 100,
    completion: 0,
    project_id: "proj-1",
    source_challenge_id: "ml-ch-1",
    cp_per_validation: 5,
    required_validations: 3,
    compute_enabled: false,
    ...over,
  };
}

function makeContribution(over: Partial<Contribution> = {}): Contribution {
  return {
    uuid: "contrib-1",
    title: "API Packaging Submission",
    type: "api_packaging",
    reward: 0,
    user_id: "alice",
    challenge_id: "ml-ch-1",
    live_endpoint_url: "https://alice-model.example.com/predict",
    submitted_at: new Date(),
    ...over,
  };
}

function makeTarget(over: Partial<ValidationTarget> = {}): ValidationTarget {
  return {
    uuid: "target-1",
    validation_challenge_id: "vch-1",
    contribution_id: "contrib-1",
    position: 0,
    outcome: "pending",
    resolved_at: null,
    created_at: new Date(),
    ...over,
  };
}

function makeUser(over: Partial<User> = {}): User {
  return { uuid: "bob", role: "medical_pro", full_name: "Bob", created_at: new Date(), ...over };
}

function makeCase(over: Partial<ValidationReferenceCase> = {}): ValidationReferenceCase {
  return {
    uuid: "case-1",
    validation_challenge_id: "vch-1",
    author_user_id: "carol",
    input_bytes: Buffer.from("input"),
    input_filename: "case.png",
    input_content_type: "image/png",
    expected_output_bytes: Buffer.from('{"label":"cat"}'),
    expected_output_filename: null,
    expected_output_content_type: "application/json",
    created_at: new Date(),
    ...over,
  };
}

function makeClaim(over: Partial<ValidationCaseClaim> = {}): ValidationCaseClaim {
  return {
    uuid: "claim-1",
    reference_case_id: "case-1",
    contribution_id: "contrib-1",
    validator_user_id: "bob",
    response_bytes: Buffer.from('{"label":"cat"}'),
    response_content_type: "application/json",
    response_status: 200,
    observation: null,
    observed_at: null,
    revealed_at: null,
    created_at: new Date(),
    ...over,
  };
}

function makeDeps(opts: {
  challenge?: Partial<Challenge> | null;
  target?: ValidationTarget | null;
  contribution?: Contribution | null;
  user?: User | null;
  refCase?: Partial<ReturnType<typeof makeCase>> | null;
  existingCasesCount?: number;
  createClaimResult?: ValidationCaseClaim | null;
  claim?: ValidationCaseClaim | null;
  markObservedResult?: ValidationCaseClaim | null;
  expectedOutput?: { expected_output_bytes: Buffer; expected_output_filename: string | null; expected_output_content_type: string } | null;
} = {}): ReferenceCaseDeps {
  const challenge = opts.challenge === null ? null : makeChallenge(opts.challenge ?? {});
  const target = opts.target === undefined ? makeTarget() : opts.target;
  const contribution = opts.contribution === undefined ? makeContribution() : opts.contribution;
  const user = opts.user === undefined ? makeUser() : opts.user;
  const refCase = opts.refCase === undefined ? makeCase() : (opts.refCase ? makeCase(opts.refCase) : null);

  return {
    challengeRepo: { findById: vi.fn(async () => challenge) },
    targetRepo: { findByChallengeAndContribution: vi.fn(async () => target) },
    contributionRepo: { findById: vi.fn(async () => contribution) },
    userRepo: { findById: vi.fn(async () => user) },
    caseRepo: {
      countByChallenge: vi.fn(async () => opts.existingCasesCount ?? 0),
      create: vi.fn(async (entity: any) => ({ uuid: "case-new", created_at: new Date(), ...entity })),
      findInputById: vi.fn(async () => refCase),
      findExpectedOutputById: vi.fn(async () => opts.expectedOutput ?? (refCase ? {
        expected_output_bytes: refCase.expected_output_bytes,
        expected_output_filename: refCase.expected_output_filename,
        expected_output_content_type: refCase.expected_output_content_type,
      } : null)),
      findClaimable: vi.fn(async () => []),
    } as any,
    caseClaimRepo: {
      create: vi.fn(async () => (opts.createClaimResult === undefined ? makeClaim() : opts.createClaimResult)),
      findById: vi.fn(async () => (opts.claim === undefined ? makeClaim() : opts.claim)),
      markObserved: vi.fn(async () => (opts.markObservedResult === undefined ? makeClaim({ observed_at: new Date() }) : opts.markObservedResult)),
      markRevealed: vi.fn(async () => makeClaim({ revealed_at: new Date() })),
    } as any,
  };
}

describe("ReferenceCaseService.authorCase", () => {
  const authorInput = {
    validationChallengeId: "vch-1",
    authorUserId: "bob",
    input: { buffer: Buffer.from("in"), filename: "in.png", contentType: "image/png" },
    expectedOutput: { buffer: Buffer.from("out"), filename: null, contentType: "text/plain" },
  };

  it("creates a case for a medical_pro author under quota", async () => {
    const deps = makeDeps({ existingCasesCount: 1 });
    const service = new ReferenceCaseService(deps);

    const created = await service.authorCase(authorInput);

    expect(created.uuid).toBe("case-new");
    expect(deps.caseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ validation_challenge_id: "vch-1", author_user_id: "bob" })
    );
  });

  it("throws InsufficientRoleError for a non-medical_pro author", async () => {
    const deps = makeDeps({ user: makeUser({ role: "contributor" }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.authorCase(authorInput)).rejects.toThrow(InsufficientRoleError);
  });

  it("throws ReferenceCaseQuotaError once required_validations cases already exist", async () => {
    const deps = makeDeps({ existingCasesCount: 3, challenge: { required_validations: 3 } });
    const service = new ReferenceCaseService(deps);

    await expect(service.authorCase(authorInput)).rejects.toThrow(ReferenceCaseQuotaError);
  });
});

const claimInput = {
  validationChallengeId: "vch-1",
  contributionId: "contrib-1",
  referenceCaseId: "case-1",
  validatorUserId: "bob",
};

describe("ReferenceCaseService.claimCase", () => {
  it("claims a case, proxies the input to the live endpoint, and returns the claim + live response", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
      arrayBuffer: async () => new TextEncoder().encode('{"label":"cat"}').buffer,
    });
    const deps = makeDeps();
    const service = new ReferenceCaseService(deps);

    const { claim, liveResponse } = await service.claimCase(claimInput);

    expect(claim.uuid).toBe("claim-1");
    expect(liveResponse.status).toBe(200);
    expect(deps.caseClaimRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ reference_case_id: "case-1", contribution_id: "contrib-1", validator_user_id: "bob" })
    );
  });

  it("throws InsufficientRoleError for a non-medical_pro validator", async () => {
    const deps = makeDeps({ user: makeUser({ role: "contributor" }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(InsufficientRoleError);
  });

  it("throws SelfAuthoredCaseError when claiming a case authored by the caller", async () => {
    const deps = makeDeps({ refCase: { author_user_id: "bob" } });
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(SelfAuthoredCaseError);
  });

  it("throws SelfVoteError when the target is the caller's own submission", async () => {
    const deps = makeDeps({ contribution: makeContribution({ user_id: "bob" }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(SelfVoteError);
  });

  it("throws ValidationTargetError when the target isn't exposed on this challenge", async () => {
    const deps = makeDeps({ target: null });
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(ValidationTargetError);
  });

  it("propagates EndpointCallError from a failing proxy call", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const deps = makeDeps();
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(EndpointCallError);
  });

  it("throws DuplicateClaimError on a lost claim race, without retrying the endpoint call", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
      arrayBuffer: async () => new TextEncoder().encode('{"label":"cat"}').buffer,
    });
    const deps = makeDeps({ createClaimResult: null }); // simulates the unique-index race loss
    const service = new ReferenceCaseService(deps);

    await expect(service.claimCase(claimInput)).rejects.toThrow(DuplicateClaimError);
    expect(mockFetch).toHaveBeenCalledTimes(1); // the wasted call happened once — no retry
  });
});

describe("ReferenceCaseService.recordObservation", () => {
  const obsInput = { claimId: "claim-1", validatorUserId: "bob", observation: "Looks correct" };

  it("records the observation on a claim owned by the caller", async () => {
    const deps = makeDeps();
    const service = new ReferenceCaseService(deps);

    const updated = await service.recordObservation(obsInput);

    expect(updated.observed_at).toBeInstanceOf(Date);
    expect(deps.caseClaimRepo.markObserved).toHaveBeenCalledWith("claim-1", "Looks correct");
  });

  it("throws ClaimNotFoundError when the claim doesn't exist", async () => {
    const deps = makeDeps({ claim: null });
    const service = new ReferenceCaseService(deps);

    await expect(service.recordObservation(obsInput)).rejects.toThrow(ClaimNotFoundError);
  });

  it("throws ForbiddenClaimAccessError for a non-owner", async () => {
    const deps = makeDeps({ claim: makeClaim({ validator_user_id: "someone-else" }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.recordObservation(obsInput)).rejects.toThrow(ForbiddenClaimAccessError);
  });

  it("throws ObservationAlreadyRecordedError when an observation already exists", async () => {
    const deps = makeDeps({ markObservedResult: null }); // simulates the observed_at IS NULL guard losing
    const service = new ReferenceCaseService(deps);

    await expect(service.recordObservation(obsInput)).rejects.toThrow(ObservationAlreadyRecordedError);
  });
});

describe("ReferenceCaseService.revealExpectedOutput", () => {
  const revealInput = { claimId: "claim-1", validatorUserId: "bob" };

  it("rejects a reveal attempt before an observation was recorded — the anti-confirmation-bias gate", async () => {
    const deps = makeDeps({ claim: makeClaim({ observed_at: null }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.revealExpectedOutput(revealInput)).rejects.toThrow(ObservationRequiredError);
  });

  it("returns the expected output once observed", async () => {
    const deps = makeDeps({ claim: makeClaim({ observed_at: new Date() }) });
    const service = new ReferenceCaseService(deps);

    const out = await service.revealExpectedOutput(revealInput);

    expect(out.contentType).toBe("application/json");
    expect(out.body).toEqual(Buffer.from('{"label":"cat"}'));
  });

  it("is idempotent — a second reveal call still returns the same expected output without erroring", async () => {
    const deps = makeDeps({ claim: makeClaim({ observed_at: new Date(), revealed_at: new Date() }) });
    const service = new ReferenceCaseService(deps);

    const out = await service.revealExpectedOutput(revealInput);

    expect(out.body).toEqual(Buffer.from('{"label":"cat"}'));
  });

  it("throws ForbiddenClaimAccessError for a non-owner", async () => {
    const deps = makeDeps({ claim: makeClaim({ validator_user_id: "someone-else", observed_at: new Date() }) });
    const service = new ReferenceCaseService(deps);

    await expect(service.revealExpectedOutput(revealInput)).rejects.toThrow(ForbiddenClaimAccessError);
  });
});
