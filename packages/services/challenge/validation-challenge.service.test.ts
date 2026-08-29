import { describe, it, expect, vi } from "vitest";

import {
  ValidationChallengeService,
  ValidationTargetError,
  SelfVoteError,
  DuplicateVerdictError,
  InsufficientRoleError,
  ClaimNotFoundError,
  ForbiddenClaimAccessError,
  ClaimNotRevealedError,
} from "./validation-challenge.service.js";
import type { ValidationRunDeps } from "./validation-challenge.service.js";
import type {
  Challenge,
  Contribution,
  ValidationAttempt,
  ValidationCaseClaim,
  RewardEntry,
  User,
} from "../../database-service/domain/entities.js";

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

function makeClaim(over: Partial<ValidationCaseClaim> = {}): ValidationCaseClaim {
  return {
    uuid: "claim-1",
    reference_case_id: "case-1",
    contribution_id: "contrib-1",
    validator_user_id: "bob",
    response_bytes: Buffer.from('{"label":"cat"}'),
    response_content_type: "application/json",
    response_status: 200,
    observation: "Looked correct",
    observed_at: new Date(),
    revealed_at: new Date(),
    created_at: new Date(),
    ...over,
  };
}

function makeUser(over: Partial<User> = {}): User {
  return {
    uuid: "bob",
    role: "medical_pro",
    full_name: "Bob",
    created_at: new Date(),
    ...over,
  };
}

function makeDeps(opts: {
  challenge?: Partial<Challenge>;
  target?: { outcome?: "pending" | "works" | "broken" };
  existingAttempts?: ValidationAttempt[];
  overrideResolve?: (uuid: string, outcome: "works" | "broken") => Promise<any>;
  users?: Record<string, User | null>;
  claims?: Record<string, ValidationCaseClaim | null>;
} = {}): ValidationRunDeps {
  const challenge = makeChallenge(opts.challenge);
  const contribution = makeContribution();
  let target = {
    uuid: "target-1",
    validation_challenge_id: "vch-1",
    contribution_id: "contrib-1",
    position: 0,
    outcome: opts.target?.outcome ?? ("pending" as const),
    resolved_at: null as Date | null,
    created_at: new Date(),
  };
  const attempts: ValidationAttempt[] = [...(opts.existingAttempts ?? [])];
  const entries: RewardEntry[] = [];
  const validatorContributions: Contribution[] = [];

  const users: Record<string, User | null> = { bob: makeUser(), ...opts.users };
  const claims: Record<string, ValidationCaseClaim | null> = { "claim-1": makeClaim(), ...opts.claims };

  return {
    challengeRepo: { findById: vi.fn(async (id: string) => (id === challenge.uuid ? challenge : null)) },
    targetRepo: {
      findByChallenge: vi.fn(async () => [target]),
      resolve: opts.overrideResolve
        ? vi.fn(opts.overrideResolve)
        : vi.fn(async (uuid: string, outcome: "works" | "broken") => {
            if (uuid !== target.uuid || target.outcome !== "pending") return null;
            target = { ...target, outcome, resolved_at: new Date() };
            return target;
          }),
    },
    attemptRepo: {
      exists: vi.fn(async (_c: string, _t: string, validatorId: string) =>
        attempts.some(a => a.validator_user_id === validatorId)
      ),
      create: vi.fn(async (entity: any) => {
        const row: ValidationAttempt = { uuid: `att-${attempts.length + 1}`, created_at: new Date(), ...entity };
        attempts.push(row);
        return row;
      }),
      findByChallengeAndContribution: vi.fn(async () => [...attempts]),
    },
    contributionRepo: {
      findById: vi.fn(async (id: string) => (id === contribution.uuid ? contribution : null)),
      findByChallenge: vi.fn(async () => validatorContributions),
      create: vi.fn(async (entity: any) => {
        const row: Contribution = { uuid: `vc-${validatorContributions.length + 1}`, ...entity };
        validatorContributions.push(row);
        return row;
      }),
      update: vi.fn(async () => contribution),
    },
    rewardRepo: {
      sumByChallenge: vi.fn(async () => entries.reduce((s, e) => s + e.points, 0)),
      createManyAndSyncRewards: vi.fn(async (drafts: any[]) => {
        const rows = drafts.map((d, i) => ({ uuid: `re-${entries.length + i + 1}`, created_at: new Date(), ...d }));
        entries.push(...(rows as RewardEntry[]));
        return rows;
      }),
    },
    userRepo: { findById: vi.fn(async (id: string) => users[id] ?? null) },
    caseClaimRepo: { findById: vi.fn(async (id: string) => claims[id] ?? null) },
  } as ValidationRunDeps;
}

// Every voter in the multi-validator tests below needs their own revealed
// claim — bob's claim-1 covers the single-voter tests, these back the
// quorum/majority tests where carol/dave/erin also vote.
function withExtraClaims(deps: ValidationRunDeps, ids: string[]) {
  const claims: Record<string, ValidationCaseClaim> = {};
  const users: Record<string, User> = {};
  for (const id of ids) {
    claims[`claim-${id}`] = makeClaim({ uuid: `claim-${id}`, validator_user_id: id });
    users[id] = makeUser({ uuid: id });
  }
  deps.caseClaimRepo.findById = vi.fn(async (claimId: string) =>
    claimId === "claim-1" ? makeClaim() : claims[claimId] ?? null
  );
  deps.userRepo.findById = vi.fn(async (id: string) => (id === "bob" ? makeUser() : users[id] ?? null));
  return deps;
}

const baseInput = {
  validationChallengeId: "vch-1",
  contributionId: "contrib-1",
  verdict: "works" as const,
  description: "Looked correct on the sample input",
  referenceCaseClaimId: "claim-1",
};

describe("ValidationChallengeService.castVerdict", () => {
  it("records a verdict and reports the running count while below quorum", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ ...baseInput, validatorUserId: "bob" });

    expect(result).toEqual({
      verdictRecorded: true,
      resolved: false,
      outcome: "pending",
      verdictCount: 1,
      requiredValidations: 3,
      cpAwarded: 0,
    });
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("writes reference_case_claim_id on the created attempt and leaves the legacy blob fields null", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ ...baseInput, validatorUserId: "bob", verdict: "broken", description: "It crashed on a 512x512 input" });

    expect(deps.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "broken",
        description: "It crashed on a 512x512 input",
        reference_case_claim_id: "claim-1",
        file_bytes: null,
        file_filename: null,
        file_content_type: null,
        response_bytes: null,
        response_content_type: null,
        response_status: null,
      })
    );
  });

  it("throws InsufficientRoleError for a non-medical_pro validator", async () => {
    const deps = makeDeps({ users: { bob: makeUser({ role: "contributor" }) } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(InsufficientRoleError);
  });

  it("throws InsufficientRoleError when the validator user no longer exists", async () => {
    const deps = makeDeps({ users: { bob: null } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(InsufficientRoleError);
  });

  it("throws ClaimNotFoundError when the claim doesn't exist", async () => {
    const deps = makeDeps({ claims: { "claim-1": null } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(ClaimNotFoundError);
  });

  it("throws ForbiddenClaimAccessError when the claim belongs to a different validator", async () => {
    const deps = makeDeps({ claims: { "claim-1": makeClaim({ validator_user_id: "someone-else" }) } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(ForbiddenClaimAccessError);
  });

  it("throws ValidationTargetError when the claim was made against a different target", async () => {
    const deps = makeDeps({ claims: { "claim-1": makeClaim({ contribution_id: "some-other-contrib" }) } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(ValidationTargetError);
  });

  it("throws ClaimNotRevealedError when the claim hasn't been revealed yet", async () => {
    const deps = makeDeps({ claims: { "claim-1": makeClaim({ revealed_at: null }) } });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "bob" })).rejects.toThrow(ClaimNotRevealedError);
  });

  it("throws SelfVoteError when the validator owns the target submission", async () => {
    const deps = makeDeps({
      users: { alice: makeUser({ uuid: "alice", role: "medical_pro" }) },
      claims: { "claim-1": makeClaim({ validator_user_id: "alice" }) },
    });
    const service = new ValidationChallengeService(deps);

    await expect(service.castVerdict({ ...baseInput, validatorUserId: "alice" })).rejects.toThrow(SelfVoteError);
  });

  it("throws DuplicateVerdictError when the validator already voted", async () => {
    const deps = makeDeps({
      existingAttempts: [
        {
          uuid: "att-0",
          validation_challenge_id: "vch-1",
          contribution_id: "contrib-1",
          validator_user_id: "bob",
          verdict: "works",
          description: "already voted",
          created_at: new Date(),
          file_bytes: null,
          file_filename: null,
          file_content_type: null,
          response_bytes: null,
          response_content_type: null,
          response_status: null,
          purged_at: null,
          reference_case_claim_id: "claim-1",
        },
      ],
    });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.castVerdict({ ...baseInput, validatorUserId: "bob", verdict: "broken", description: "still bad" })
    ).rejects.toThrow(DuplicateVerdictError);
  });

  it("resolves the target and pays the majority once quorum is reached", async () => {
    const deps = withExtraClaims(makeDeps(), ["carol", "dave"]);
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ ...baseInput, validatorUserId: "bob", verdict: "works", referenceCaseClaimId: "claim-1" });
    await service.castVerdict({ ...baseInput, validatorUserId: "carol", verdict: "broken", description: "bad output", referenceCaseClaimId: "claim-carol" });
    const result = await service.castVerdict({ ...baseInput, validatorUserId: "dave", verdict: "works", referenceCaseClaimId: "claim-dave" });

    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.verdictCount).toBe(3);
    expect(result.cpAwarded).toBe(5); // dave voted with the majority

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.user_id).sort()).toEqual(["bob", "dave"]); // majority side only — carol gets nothing
  });

  it("clamps the payout batch to whatever remains in the pool", async () => {
    const deps = withExtraClaims(makeDeps({ challenge: { contribution_points_reward: 8, cp_per_validation: 5 } }), ["carol", "dave"]);
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ ...baseInput, validatorUserId: "bob", verdict: "works", referenceCaseClaimId: "claim-1" });
    await service.castVerdict({ ...baseInput, validatorUserId: "carol", verdict: "works", referenceCaseClaimId: "claim-carol" });
    await service.castVerdict({ ...baseInput, validatorUserId: "dave", verdict: "broken", description: "nope", referenceCaseClaimId: "claim-dave" });

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.points)).toEqual([5, 3]); // bob gets the full 5, carol gets whatever's left
  });

  it("does not pay out twice if a concurrent request already resolved the target", async () => {
    const deps = withExtraClaims(
      makeDeps({
        existingAttempts: [
          { uuid: "att-1", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "bob", verdict: "works", description: "ok", created_at: new Date(), file_bytes: null, file_filename: null, file_content_type: null, response_bytes: null, response_content_type: null, response_status: null, purged_at: null, reference_case_claim_id: "claim-1" },
          { uuid: "att-2", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "carol", verdict: "works", description: "ok", created_at: new Date(), file_bytes: null, file_filename: null, file_content_type: null, response_bytes: null, response_content_type: null, response_status: null, purged_at: null, reference_case_claim_id: "claim-carol" },
        ],
        overrideResolve: async () => null, // another request already resolved it
      }),
      ["carol", "dave"]
    );
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ ...baseInput, validatorUserId: "dave", verdict: "works", referenceCaseClaimId: "claim-dave" });

    expect(result.resolved).toBe(true);
    expect(result.cpAwarded).toBe(0);
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("still records a late vote on an already-resolved target but pays nothing", async () => {
    const deps = makeDeps({ target: { outcome: "works" } });
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ ...baseInput, validatorUserId: "bob", verdict: "broken", description: "seems off" });

    expect(result.verdictRecorded).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.cpAwarded).toBe(0);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
    expect(deps.targetRepo.resolve).not.toHaveBeenCalled();
  });
});
