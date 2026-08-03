import { describe, it, expect, vi } from "vitest";

// assertPublicHttpUrl (called directly by the service, not through injectable
// deps) does a real DNS lookup — mock it so these tests exercise the service's
// own logic without touching the network. SSRF-guard behavior itself is
// covered exhaustively in ssrf-guard.test.ts.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "203.0.113.10", family: 4 }]),
}));

import {
  ValidationChallengeService,
  ValidationTargetError,
  EndpointCallError,
  SelfVoteError,
  DuplicateVerdictError,
} from "./validation-challenge.service.js";
import type { ValidationRunDeps } from "./validation-challenge.service.js";
import type {
  Challenge,
  Contribution,
  ValidationAttempt,
  RewardEntry,
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

const file = { buffer: Buffer.from("fake-bytes"), filename: "cat.png", mimeType: "image/png" };
const response = { status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') };

function makeDeps(opts: {
  challenge?: Partial<Challenge>;
  target?: { outcome?: "pending" | "works" | "broken" };
  existingAttempts?: ValidationAttempt[];
  overrideResolve?: (uuid: string, outcome: "works" | "broken") => Promise<any>;
  callEndpoint?: ValidationRunDeps["callEndpoint"];
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
    callEndpoint:
      opts.callEndpoint ??
      vi.fn(async () => ({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') })),
  } as ValidationRunDeps;
}

describe("ValidationChallengeService.validate", () => {
  it("returns the endpoint's response for a successful call", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result).toEqual({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') });
  });

  it("passes through a non-2xx status without throwing", async () => {
    const deps = makeDeps({
      callEndpoint: vi.fn(async () => ({ status: 500, contentType: "text/plain", body: Buffer.from("boom") })),
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result.status).toBe(500);
  });

  it("throws ValidationTargetError when the contribution isn't an exposed target", async () => {
    const deps = makeDeps();
    deps.targetRepo.findByChallenge = vi.fn(async () => []);
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("throws ValidationTargetError when the target contribution has no live endpoint", async () => {
    const deps = makeDeps();
    deps.contributionRepo.findById = vi.fn(async () => null);
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("wraps a failing endpoint call in EndpointCallError", async () => {
    const deps = makeDeps({ callEndpoint: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(EndpointCallError);
  });
});

describe("ValidationChallengeService.castVerdict", () => {
  it("records a verdict and reports the running count while below quorum", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({
      validationChallengeId: "vch-1",
      contributionId: "contrib-1",
      validatorUserId: "bob",
      verdict: "works",
      description: null,
      file,
      response,
    });

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

  it("persists exactly the file and response bytes/metadata passed in, alongside the verdict", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({
      validationChallengeId: "vch-1",
      contributionId: "contrib-1",
      validatorUserId: "bob",
      verdict: "broken",
      description: "It crashed on a 512x512 input",
      file,
      response,
    });

    expect(deps.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "broken",
        description: "It crashed on a 512x512 input",
        file_bytes: file.buffer,
        file_filename: "cat.png",
        file_content_type: "image/png",
        response_bytes: response.body,
        response_content_type: "application/json",
        response_status: 200,
      })
    );
  });

  it("throws SelfVoteError when the validator owns the target submission", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await expect(
      service.castVerdict({
        validationChallengeId: "vch-1",
        contributionId: "contrib-1",
        validatorUserId: "alice", // same as makeContribution()'s user_id
        verdict: "works",
        description: null,
        file,
        response,
      })
    ).rejects.toThrow(SelfVoteError);
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
          description: null,
          created_at: new Date(),
          file_bytes: null,
          file_filename: null,
          file_content_type: null,
          response_bytes: null,
          response_content_type: null,
          response_status: null,
          purged_at: null,
        },
      ],
    });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.castVerdict({
        validationChallengeId: "vch-1",
        contributionId: "contrib-1",
        validatorUserId: "bob",
        verdict: "broken",
        description: "still bad",
        file,
        response,
      })
    ).rejects.toThrow(DuplicateVerdictError);
  });

  it("resolves the target and pays the majority once quorum is reached", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", verdict: "works", description: null, file, response });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "carol", verdict: "broken", description: "bad output", file, response });
    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "works", description: null, file, response });

    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.verdictCount).toBe(3);
    expect(result.cpAwarded).toBe(5); // dave voted with the majority

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.user_id).sort()).toEqual(["bob", "dave"]); // majority side only — carol gets nothing
  });

  it("clamps the payout batch to whatever remains in the pool", async () => {
    const deps = makeDeps({ challenge: { contribution_points_reward: 8, cp_per_validation: 5 } });
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", verdict: "works", description: null, file, response });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "carol", verdict: "works", description: null, file, response });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "broken", description: "nope", file, response });

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.points)).toEqual([5, 3]); // bob gets the full 5, carol gets whatever's left
  });

  it("does not pay out twice if a concurrent request already resolved the target", async () => {
    const deps = makeDeps({
      existingAttempts: [
        { uuid: "att-1", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "bob", verdict: "works", description: null, created_at: new Date(), file_bytes: null, file_filename: null, file_content_type: null, response_bytes: null, response_content_type: null, response_status: null, purged_at: null },
        { uuid: "att-2", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "carol", verdict: "works", description: null, created_at: new Date(), file_bytes: null, file_filename: null, file_content_type: null, response_bytes: null, response_content_type: null, response_status: null, purged_at: null },
      ],
      overrideResolve: async () => null, // another request already resolved it
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "works", description: null, file, response });

    expect(result.resolved).toBe(true);
    expect(result.cpAwarded).toBe(0);
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("still records a late vote on an already-resolved target but pays nothing", async () => {
    const deps = makeDeps({ target: { outcome: "works" } });
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "erin", verdict: "broken", description: "seems off", file, response });

    expect(result.verdictRecorded).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.cpAwarded).toBe(0);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
    expect(deps.targetRepo.resolve).not.toHaveBeenCalled();
  });
});
