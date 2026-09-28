import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  challengeRepo: { findById: vi.fn() },
  contributionRepo: { findByChallenge: vi.fn(), findById: vi.fn(), update: vi.fn() },
  targetRepo: { findByChallenge: vi.fn(), findByChallengeAndContribution: vi.fn(), findById: vi.fn(), create: vi.fn(), delete: vi.fn() },
  attemptRepo: { findByChallengeAndValidator: vi.fn(), findByChallengeAndContribution: vi.fn() },
  rewardRepo: { sumByChallenge: vi.fn() },
  userRepo: { findByIds: vi.fn() },
  caseClaimRepo: { findByValidatorAndTarget: vi.fn() },
  scenarioRunRepo: { findByChallenge: vi.fn(), findByChallengeAndValidator: vi.fn() },
  assertPublicHttpUrl: vi.fn(),
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => {
  const returning = (target: object) => class { constructor() { return target; } };
  return {
    ChallengeRepository: returning(h.challengeRepo),
    ContributionRepository: returning(h.contributionRepo),
    ValidationTargetRepository: returning(h.targetRepo),
    ValidationAttemptRepository: returning(h.attemptRepo),
    RewardEntryRepository: returning(h.rewardRepo),
    UserRepository: returning(h.userRepo),
    CaseClaimRepository: returning(h.caseClaimRepo),
    ScenarioRunRepository: returning(h.scenarioRunRepo),
  };
});

vi.mock("../../../../packages/capabilities/http-proxy/ssrf-guard.js", () => ({ assertPublicHttpUrl: h.assertPublicHttpUrl }));

import { actionContext, type ActionContextOptions } from "../../../../packages/capabilities/testing/action-context.js";
import { validationKitActions } from "./index.js";
import { addTarget, listTargets, removeTarget } from "./targets.js";

const CHALLENGE_ID = "challenge-1";
const CONTRIBUTION_ID = "11111111-1111-4111-8111-111111111111";

const VALIDATION_CHALLENGE = {
  uuid: CHALLENGE_ID, type: "endpoint-validation", contribution_points_reward: 100,
  flow_config: { cp_per_validation: 5, required_validations: 3, reviewer_qualification: "medical_pro" },
  source_challenge_id: "ml-challenge-1",
};

let challenge: Record<string, unknown> = VALIDATION_CHALLENGE;

const ctx = (options: ActionContextOptions = {}) =>
  actionContext({ challenge, user: { id: "u1", role: "contributor" }, ...options });

const asAdmin = { user: { id: "admin-1", role: "admin" } };

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
  challenge = VALIDATION_CHALLENGE;
  h.challengeRepo.findById.mockImplementation(async (id: string) =>
    id === "ml-challenge-1" ? { uuid: "ml-challenge-1", type: "ml" } : { uuid: "code-challenge-1", type: "code" },
  );
  h.contributionRepo.findByChallenge.mockResolvedValue([]);
  h.targetRepo.findByChallenge.mockResolvedValue([]);
  h.targetRepo.findByChallengeAndContribution.mockResolvedValue(null);
  h.attemptRepo.findByChallengeAndValidator.mockResolvedValue([]);
  h.attemptRepo.findByChallengeAndContribution.mockResolvedValue([]);
  h.rewardRepo.sumByChallenge.mockResolvedValue(0);
  h.userRepo.findByIds.mockResolvedValue([]);
  h.assertPublicHttpUrl.mockResolvedValue(undefined);
  h.caseClaimRepo.findByValidatorAndTarget.mockResolvedValue([]);
  h.scenarioRunRepo.findByChallenge.mockResolvedValue([]);
  h.scenarioRunRepo.findByChallengeAndValidator.mockResolvedValue([]);
});

describe("validation kit — declared access", () => {
  const access = (method: string, path: string) => validationKitActions.find((a) => a.method === method && a.path === path)?.access;

  it("lets any participant read the targets", () => {
    expect(access("GET", "targets")).toEqual({});
  });

  it("keeps exposing, removing and the rewards to an admin or the challenge's manager", () => {
    const managers = { roles: ["admin"], manager: true };
    expect(access("POST", "targets")).toEqual(managers);
    expect(access("DELETE", "targets/:targetId")).toEqual(managers);
    expect(access("GET", "rewards")).toEqual(managers);
  });
});

describe("GET targets", () => {
  describe("?eligible=true", () => {
    const eligibleUrl = `/api/challenges/${CHALLENGE_ID}/flow/targets?eligible=true`;

    it("returns 403 for a participant who neither administers nor manages the challenge", async () => {
      expect((await read(await listTargets(ctx({ url: eligibleUrl })))).status).toBe(403);
    });

    it("lists api_packaging contributions that are not already a target, regardless of whether an endpoint is already saved", async () => {
      h.contributionRepo.findByChallenge.mockResolvedValue([
        { uuid: "c1", type: "api_packaging", live_endpoint_url: "https://x", user_id: "u1" },
        { uuid: "c2", type: "api_packaging", live_endpoint_url: null, user_id: "u2" },
        { uuid: "c3", type: "dataset", live_endpoint_url: "https://y", user_id: "u3" },
        { uuid: "c4", type: "api_packaging", live_endpoint_url: "https://z", user_id: "u4" },
      ]);
      h.targetRepo.findByChallenge.mockResolvedValue([{ contribution_id: "c4" }]);
      h.userRepo.findByIds.mockResolvedValue([{ uuid: "u1", full_name: "Alice" }, { uuid: "u2", full_name: "Bob" }]);

      const { status, body } = await read(await listTargets(ctx({ url: eligibleUrl, ...asAdmin })));

      expect(status).toBe(200);
      expect(body.eligible).toEqual([
        { contributionId: "c1", userId: "u1", userName: "Alice" },
        { contributionId: "c2", userId: "u2", userName: "Bob" },
      ]);
    });

    it("lets the challenge's manager list them too", async () => {
      expect((await read(await listTargets(ctx({ url: eligibleUrl, access: { manager: true } })))).status).toBe(200);
    });

    it("returns an empty eligible list when the challenge has no source challenge", async () => {
      challenge = { ...VALIDATION_CHALLENGE, source_challenge_id: null };

      const { body } = await read(await listTargets(ctx({ url: eligibleUrl, ...asAdmin })));

      expect(body.eligible).toEqual([]);
      expect(h.contributionRepo.findByChallenge).not.toHaveBeenCalled();
    });
  });

  it("returns pool state and targets to a plain participant, without the works/broken split", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "t1", contribution_id: "c1", outcome: "pending", resolved_at: null }]);
    h.rewardRepo.sumByChallenge.mockResolvedValue(15);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "c1", user_id: "u9" });
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "u9", full_name: "Alice", avatar_url: null }]);
    h.attemptRepo.findByChallengeAndContribution.mockResolvedValue([{ verdict: "works" }, { verdict: "broken" }, { verdict: "works" }]);

    const { body } = await read(await listTargets(ctx()));

    expect(body.currentUserId).toBe("u1");
    expect(body.mode).toBe("reference_case");
    expect(body.pool).toEqual({ pool: 100, distributed: 15, remaining: 85, cpPerValidation: 5, requiredValidations: 3 });
    expect(body.targets).toHaveLength(1);
    const target = body.targets[0];
    expect(target.submitterName).toBe("Alice");
    expect(target.alreadyValidatedByMe).toBe(false);
    expect(target.verdictCount).toBe(3);
    expect(target.worksCount).toBeUndefined();
    expect(target.brokenCount).toBeUndefined();
  });

  it("says whether the caller can review, from the qualification the challenge requires", async () => {
    const withoutIt = await read(await listTargets(ctx()));
    const withIt = await read(await listTargets(ctx({ access: { qualifications: ["medical_pro"] } })));

    expect(withoutIt.body.viewer).toEqual({ canReview: false });
    expect(withIt.body.viewer).toEqual({ canReview: true });
  });

  it("never discloses the contributor endpoint URL in reference-case mode — only the server-side proxy ever calls it", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "t1", contribution_id: "c1", outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "c1", user_id: "u1", live_endpoint_url: "https://model.example.com/predict" });

    const { body } = await read(await listTargets(ctx()));

    expect(body.targets[0].endpointUrl).toBeUndefined();
  });

  it("exposes worksCount/brokenCount and alreadyValidatedByMe to an admin", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "t1", contribution_id: "c1", outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "c1", user_id: "u1" });
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "u1", full_name: "Alice", avatar_url: null }]);
    h.attemptRepo.findByChallengeAndValidator.mockResolvedValue([{ contribution_id: "c1" }]);
    h.attemptRepo.findByChallengeAndContribution.mockResolvedValue([{ verdict: "works" }, { verdict: "broken" }]);

    const { body } = await read(await listTargets(ctx(asAdmin)));

    expect(body.currentUserId).toBe("admin-1");
    expect(body.targets[0].alreadyValidatedByMe).toBe(true);
    expect(body.targets[0].worksCount).toBe(1);
    expect(body.targets[0].brokenCount).toBe(1);
  });

  it("exposes worksCount/brokenCount to a manager who is not an admin", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "t1", contribution_id: "c1", outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: "c1", user_id: "u2" });

    const { body } = await read(await listTargets(ctx({ access: { manager: true } })));

    expect(body.targets[0].worksCount).toBe(0);
    expect(body.targets[0].brokenCount).toBe(0);
  });

  it("handles a target whose contribution was deleted (submitter falls back to null/Unknown)", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "t1", contribution_id: "c1", outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue(null);

    const { body } = await read(await listTargets(ctx()));

    expect(body.targets[0].submitterUserId).toBeNull();
    expect(body.targets[0].submitterName).toBe("Unknown");
  });
});

describe("POST targets", () => {
  const eligibleContribution = { uuid: CONTRIBUTION_ID, challenge_id: "ml-challenge-1", type: "api_packaging", live_endpoint_url: null };
  const LIVE_URL = "https://model.example.com/predict";
  const post = (body: unknown) => addTarget(ctx({ method: "POST", body, ...asAdmin }));

  beforeEach(() => {
    h.contributionRepo.findById.mockResolvedValue(eligibleContribution);
  });

  it("returns 400 on an invalid body (Zod)", async () => {
    expect((await read(await post({ contribution_id: "not-a-uuid", live_endpoint_url: LIVE_URL }))).status).toBe(400);
    expect(h.targetRepo.create).not.toHaveBeenCalled();
  });

  it("returns 400 when live_endpoint_url is missing or not a valid URL", async () => {
    expect((await read(await post({ contribution_id: CONTRIBUTION_ID }))).status).toBe(400);
    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: "not-a-url" }))).status).toBe(400);
    expect(h.targetRepo.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the contribution is not from the source challenge", async () => {
    h.contributionRepo.findById.mockResolvedValue({ ...eligibleContribution, challenge_id: "other-challenge" });

    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }))).status).toBe(400);
  });

  it("returns 400 when the contribution is not api_packaging", async () => {
    h.contributionRepo.findById.mockResolvedValue({ ...eligibleContribution, type: "dataset" });

    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }))).status).toBe(400);
  });

  it("returns 400 when the contribution does not exist", async () => {
    h.contributionRepo.findById.mockResolvedValue(null);

    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }))).status).toBe(400);
  });

  it("returns 409 when the contribution is already a target", async () => {
    h.targetRepo.findByChallengeAndContribution.mockResolvedValue({ uuid: "existing-target" });

    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }))).status).toBe(409);
    expect(h.targetRepo.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the endpoint fails the SSRF guard", async () => {
    h.assertPublicHttpUrl.mockRejectedValue(new Error("blocked: private address"));

    expect((await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }))).status).toBe(400);
    expect(h.contributionRepo.update).not.toHaveBeenCalled();
    expect(h.targetRepo.create).not.toHaveBeenCalled();
  });

  it("saves the endpoint on the contribution, then creates the target on success", async () => {
    const created = { uuid: "new-target", validation_challenge_id: CHALLENGE_ID, contribution_id: CONTRIBUTION_ID, position: 0 };
    h.targetRepo.create.mockResolvedValue(created);

    const { status, body } = await read(await post({ contribution_id: CONTRIBUTION_ID, live_endpoint_url: LIVE_URL }));

    expect(status).toBe(201);
    expect(h.assertPublicHttpUrl).toHaveBeenCalledWith(LIVE_URL);
    expect(h.contributionRepo.update).toHaveBeenCalledWith(CONTRIBUTION_ID, { live_endpoint_url: LIVE_URL });
    expect(h.targetRepo.create).toHaveBeenCalledWith({ validation_challenge_id: CHALLENGE_ID, contribution_id: CONTRIBUTION_ID, position: 0 });
    expect(body).toEqual(created);
  });
});

describe("DELETE targets/:targetId", () => {
  const remove = () => removeTarget(ctx({ method: "DELETE", params: { targetId: "target-1" }, ...asAdmin }));

  it("returns 404 when the target does not exist", async () => {
    h.targetRepo.findById.mockResolvedValue(null);

    expect((await read(await remove())).status).toBe(404);
  });

  it("returns 404 when the target belongs to a different challenge", async () => {
    h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: "other-challenge", contribution_id: "c1" });

    expect((await read(await remove())).status).toBe(404);
  });

  it("returns 409 when the target already has votes", async () => {
    h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: CHALLENGE_ID, contribution_id: "c1" });
    h.attemptRepo.findByChallengeAndContribution.mockResolvedValue([{ uuid: "a1" }, { uuid: "a2" }]);

    const { status, body } = await read(await remove());

    expect(status).toBe(409);
    expect(body.error).toMatch(/2 vote/);
    expect(h.targetRepo.delete).not.toHaveBeenCalled();
  });

  it("returns 409 when the target already has walkthroughs (scenario mode, where votes is always 0)", async () => {
    h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: CHALLENGE_ID, contribution_id: "c1" });
    h.scenarioRunRepo.findByChallenge.mockResolvedValue([
      { uuid: "run-1", contribution_id: "c1" },
      { uuid: "run-2", contribution_id: "c1" },
      { uuid: "run-3", contribution_id: "someone-else" },
    ]);

    const { status, body } = await read(await remove());

    expect(status).toBe(409);
    expect(body.error).toMatch(/2 walkthrough/);
    expect(h.targetRepo.delete).not.toHaveBeenCalled();
  });

  it("deletes the target when nobody has worked on it, even with walkthroughs on other targets", async () => {
    h.targetRepo.findById.mockResolvedValue({ uuid: "target-1", validation_challenge_id: CHALLENGE_ID, contribution_id: "c1" });
    h.scenarioRunRepo.findByChallenge.mockResolvedValue([{ uuid: "run-1", contribution_id: "someone-else" }]);

    expect(await remove()).toEqual({ success: true });
    expect(h.targetRepo.delete).toHaveBeenCalledWith("target-1");
  });
});

describe("scenario mode (source challenge is a code challenge)", () => {
  const CODE_SOURCE_ID = "code-challenge-1";
  const SCENARIO_CHALLENGE = {
    uuid: CHALLENGE_ID, type: "journey-validation", contribution_points_reward: 12000,
    flow_config: { cp_per_validation: 200, eligible_roles: ["contributor", "admin"] }, source_challenge_id: CODE_SOURCE_ID,
  };

  beforeEach(() => {
    challenge = SCENARIO_CHALLENGE;
    h.rewardRepo.sumByChallenge.mockResolvedValue(2600);
  });

  it("publishes the derived mode so the client picks the right flow, with nobody reviewing", async () => {
    const { body } = await read(await listTargets(ctx({ access: { qualifications: ["medical_pro"] } })));

    expect(body.mode).toBe("scenario");
    expect(body.viewer).toEqual({ canReview: false });
  });

  it("lists the source challenge project contributions as eligible, not its api_packaging ones", async () => {
    h.contributionRepo.findByChallenge.mockResolvedValue([
      { uuid: "proj-1", type: "project", user_id: "alice" },
      { uuid: "pack-1", type: "api_packaging", user_id: "bob" },
    ]);
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "alice", full_name: "Alice" }]);

    const { body } = await read(await listTargets(ctx({ url: `/api/challenges/${CHALLENGE_ID}/flow/targets?eligible=true`, ...asAdmin })));

    expect(body.eligible).toHaveLength(1);
    expect(body.eligible[0].contributionId).toBe("proj-1");
  });

  it("publishes each exposed application endpoint — the validator browser is what loads it", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "target-1", contribution_id: CONTRIBUTION_ID, outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({
      uuid: CONTRIBUTION_ID, user_id: "alice", type: "project", live_endpoint_url: "https://val-a.patient-record.mytwin.dev",
    });

    const { body } = await read(await listTargets(ctx()));

    expect(body.targets[0].endpointUrl).toBe("https://val-a.patient-record.mytwin.dev");
  });

  it("reports my own draft walkthrough so the client can offer Resume instead of Start", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "target-1", contribution_id: CONTRIBUTION_ID, outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: "alice", type: "project" });
    h.scenarioRunRepo.findByChallengeAndValidator.mockResolvedValue([{ uuid: "run-1", contribution_id: CONTRIBUTION_ID, completed_at: null }]);
    h.scenarioRunRepo.findByChallenge.mockResolvedValue([
      { uuid: "run-1", contribution_id: CONTRIBUTION_ID, completed_at: null },
      { uuid: "run-2", contribution_id: CONTRIBUTION_ID, completed_at: new Date("2026-09-10") },
    ]);

    const { body } = await read(await listTargets(ctx()));

    expect(body.targets[0].myWalkthrough).toEqual({ runId: "run-1", completedAt: null });
    expect(body.targets[0].walkthroughCount).toBe(2);
  });

  it("returns null myWalkthrough when I have never started", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "target-1", contribution_id: CONTRIBUTION_ID, outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: "alice", type: "project" });

    const { body } = await read(await listTargets(ctx()));

    expect(body.targets[0].myWalkthrough).toBeNull();
  });

  it("never queries reference-case claims nor verdicts in scenario mode", async () => {
    h.targetRepo.findByChallenge.mockResolvedValue([{ uuid: "target-1", contribution_id: CONTRIBUTION_ID, outcome: "pending", resolved_at: null }]);
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: "alice", type: "project" });

    await listTargets(ctx());

    // Il n'y a pas de cas de référence en mode scénario : interroger la table
    // serait une requête par cible pour un résultat toujours vide.
    expect(h.caseClaimRepo.findByValidatorAndTarget).not.toHaveBeenCalled();
    expect(h.attemptRepo.findByChallengeAndContribution).not.toHaveBeenCalled();
  });

  it("exposes a project contribution and records its URL", async () => {
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: "project", user_id: "alice" });
    h.targetRepo.create.mockResolvedValue({ uuid: "target-1" });

    const result = await addTarget(ctx({
      method: "POST", ...asAdmin,
      body: { contribution_id: CONTRIBUTION_ID, live_endpoint_url: "https://val-a.patient-record.mytwin.dev" },
    }));

    expect((await read(result)).status).toBe(201);
    expect(h.contributionRepo.update).toHaveBeenCalledWith(CONTRIBUTION_ID, { live_endpoint_url: "https://val-a.patient-record.mytwin.dev" });
  });

  it("refuses to expose an api_packaging contribution when the source is a code challenge", async () => {
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: "api_packaging", user_id: "alice" });

    const result = await addTarget(ctx({
      method: "POST", ...asAdmin,
      body: { contribution_id: CONTRIBUTION_ID, live_endpoint_url: "https://val-a.patient-record.mytwin.dev" },
    }));

    expect((await read(result)).status).toBe(400);
  });

  it("still SSRF-guards the URL at exposure time", async () => {
    // Le garde ne protège plus un appel serveur — il n'y en a plus — mais il
    // empêche de stocker un `javascript:` qu'on rendrait ensuite en lien, et
    // il attrape une adresse privée pendant que l'admin regarde encore le
    // formulaire.
    h.contributionRepo.findById.mockResolvedValue({ uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: "project", user_id: "alice" });
    h.assertPublicHttpUrl.mockRejectedValue(new Error("private address"));

    const result = await addTarget(ctx({
      method: "POST", ...asAdmin,
      body: { contribution_id: CONTRIBUTION_ID, live_endpoint_url: "http://192.168.0.10" },
    }));

    expect((await read(result)).status).toBe(400);
    expect(h.targetRepo.create).not.toHaveBeenCalled();
  });
});
