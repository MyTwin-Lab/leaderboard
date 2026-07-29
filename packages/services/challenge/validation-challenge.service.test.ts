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
} from "./validation-challenge.service.js";
import type { ValidationRunDeps } from "./validation-challenge.service.js";
import type {
  Challenge,
  Contribution,
  ValidationTarget,
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

function makeDeps(over: Partial<ValidationRunDeps> = {}): ValidationRunDeps {
  const challenge = makeChallenge();
  const contribution = makeContribution();
  const target: ValidationTarget = {
    uuid: "target-1",
    validation_challenge_id: "vch-1",
    contribution_id: "contrib-1",
    position: 0,
    created_at: new Date(),
  };
  const attempts: ValidationAttempt[] = [];
  const entries: RewardEntry[] = [];
  const validatorContributions: Contribution[] = [];

  return {
    challengeRepo: { findById: vi.fn(async (id: string) => (id === challenge.uuid ? challenge : null)) },
    targetRepo: { findByChallenge: vi.fn(async () => [target]) },
    attemptRepo: {
      exists: vi.fn(async (_c, _t, validatorId) => attempts.some(a => a.validator_user_id === validatorId)),
      create: vi.fn(async (entity) => {
        const row: ValidationAttempt = { uuid: `att-${attempts.length + 1}`, created_at: new Date(), ...entity };
        attempts.push(row);
        return row;
      }),
    },
    contributionRepo: {
      findById: vi.fn(async (id: string) => (id === contribution.uuid ? contribution : null)),
      findByChallenge: vi.fn(async () => validatorContributions),
      create: vi.fn(async (entity) => {
        const row: Contribution = { uuid: `vc-${validatorContributions.length + 1}`, ...entity } as Contribution;
        validatorContributions.push(row);
        return row;
      }),
      update: vi.fn(async () => contribution),
    },
    rewardRepo: {
      sumByChallenge: vi.fn(async () => entries.reduce((s, e) => s + e.points, 0)),
      createManyAndSyncRewards: vi.fn(async (drafts) => {
        const rows: RewardEntry[] = drafts.map((entity: any) => {
          const row: RewardEntry = { uuid: `re-${entries.length + 1}`, created_at: new Date(), ...entity } as RewardEntry;
          entries.push(row);
          return row;
        });
        return rows;
      }),
    },
    callEndpoint: vi.fn(async () => ({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') })),
    ...over,
  } as ValidationRunDeps;
}

describe("ValidationChallengeService.validate", () => {
  it("awards cp_per_validation on a first-time successful call", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({
      validationChallengeId: "vch-1",
      contributionId: "contrib-1",
      validatorUserId: "bob",
      file,
    });

    expect(result.status).toBe(200);
    expect(result.cpAwarded).toBe(5);
    expect(result.alreadyValidated).toBe(false);
    expect(deps.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledTimes(1);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
  });

  it("awards nothing the second time the same validator tests the same target", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);
    await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    const second = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(second.cpAwarded).toBe(0);
    expect(second.alreadyValidated).toBe(true);
    expect(deps.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledTimes(1); // still just the first call
  });

  it("awards nothing when the proxied call fails (non-2xx)", async () => {
    const deps = makeDeps({
      callEndpoint: vi.fn(async () => ({ status: 500, contentType: "text/plain", body: Buffer.from("boom") })),
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result.status).toBe(500);
    expect(result.cpAwarded).toBe(0);
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("clamps the award to whatever remains in the pool", async () => {
    const deps = makeDeps({
      challengeRepo: { findById: vi.fn(async () => makeChallenge({ contribution_points_reward: 3, cp_per_validation: 5 })) },
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result.cpAwarded).toBe(3);
  });

  it("throws ValidationTargetError when the contribution isn't an exposed target", async () => {
    const deps = makeDeps({ targetRepo: { findByChallenge: vi.fn(async () => []) } });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("throws ValidationTargetError when the target contribution has no live endpoint", async () => {
    const deps = makeDeps({
      contributionRepo: {
        findById: vi.fn(async () => makeContribution({ live_endpoint_url: undefined })),
        findByChallenge: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
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
