import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  challengeRepoRepo: { findByChallengeWithRepo: vi.fn(), findByChallengeAndRepo: vi.fn(), updateWorkspace: vi.fn() },
  userRepo: { findByIds: vi.fn() },
  contributionRepo: { findByChallenge: vi.fn(), update: vi.fn(), create: vi.fn() },
  teamRepo: { findByChallenge: vi.fn(), create: vi.fn(), findByChallengeAndUser: vi.fn() },
  rewardRepo: { maxMetaNumber: vi.fn() },
  normalizeArtifactUrl: vi.fn(),
  scheduleAward: vi.fn(),
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ChallengeRepoRepository: class {
    constructor() {
      return h.challengeRepoRepo;
    }
  },
  UserRepository: class {
    constructor() {
      return h.userRepo;
    }
  },
  ContributionRepository: class {
    constructor() {
      return h.contributionRepo;
    }
  },
  ChallengeTeamRepository: class {
    constructor() {
      return h.teamRepo;
    }
  },
  RewardEntryRepository: class {
    constructor() {
      return h.rewardRepo;
    }
  },
}));

vi.mock("../../../../packages/services/challenge/artifactUrl.js", () => ({
  normalizeArtifactUrl: h.normalizeArtifactUrl,
}));

vi.mock("../../../../packages/services/challenge/ml-rewards.service.js", () => ({
  MlRewardsService: class {
    scheduleAward = h.scheduleAward;
  },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { readWorkspace, submitWorkspace } from "./workspace.js";
import { mlFlow } from "../index.js";

const CHALLENGE_ID = "challenge-1";
const USER_ID = "user-1";

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

const getWorkspace = () => readWorkspace(actionContext({ challenge: { uuid: CHALLENGE_ID, type: "ml" }, user: { id: USER_ID } }));

async function patchWorkspace(body: unknown, rewardRules: unknown = null) {
  return read(
    await submitWorkspace(
      actionContext({
        challenge: { uuid: CHALLENGE_ID, type: "ml", reward_rules: rewardRules },
        user: { id: USER_ID },
        method: "PATCH",
        body,
      }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([]);
  h.userRepo.findByIds.mockResolvedValue([]);
  h.teamRepo.findByChallenge.mockResolvedValue([{ challenge_id: CHALLENGE_ID, user_id: USER_ID }]);
  h.teamRepo.create.mockResolvedValue(undefined);
  h.contributionRepo.findByChallenge.mockResolvedValue([]);
  h.normalizeArtifactUrl.mockImplementation((url: string) => url);
  h.rewardRepo.maxMetaNumber.mockResolvedValue(null);
});

describe("workspace — declared access", () => {
  it("lets any signed-in caller read and submit: submitting is what joins an ML challenge", () => {
    const access = (method: string) => mlFlow.actions?.find((a) => a.method === method && a.path === "workspace")?.access;
    expect(access("GET")).toEqual({});
    expect(access("PATCH")).toEqual({});
  });
});

describe("GET workspace", () => {
  it("returns repos with resolved submitter users and the caller's identity", async () => {
    h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([
      {
        repo_id: "repo-1",
        repo_type: "github",
        repo_external_id: "ext-1",
        role: "dataset",
        workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } },
      },
    ]);
    h.userRepo.findByIds.mockResolvedValue([{ uuid: USER_ID, full_name: "Ada", avatar_url: "a.png" }]);

    const body = await getWorkspace();

    expect(body.currentUserId).toBe(USER_ID);
    expect(body.workspaceOwnerId).toBe(USER_ID);
    expect(body.repos).toEqual([
      {
        repo_id: "repo-1",
        repo_type: "github",
        repo_external_id: "ext-1",
        role: "dataset",
        workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } },
      },
    ]);
    expect(body.users).toEqual({ [USER_ID]: { fullName: "Ada", avatarUrl: "a.png" } });
    expect(h.userRepo.findByIds).toHaveBeenCalledWith([USER_ID]);
  });
});

describe("PATCH workspace", () => {
  it("returns 400 when repo_id is missing, without joining the challenge team", async () => {
    h.teamRepo.findByChallenge.mockResolvedValue([]);

    const { status, body } = await patchWorkspace({ workspace_url: "https://x.com" });

    expect(status).toBe(400);
    expect(body.error).toMatch(/repo_id/);
    expect(h.teamRepo.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    expect((await patchWorkspace("not-json")).status).toBe(400);
  });

  it("returns 400 when neither workspace_url nor dataset_urls is provided", async () => {
    expect((await patchWorkspace({ repo_id: "repo-1" })).status).toBe(400);
  });

  it("returns 400 when workspace_url is an empty string", async () => {
    expect((await patchWorkspace({ repo_id: "repo-1", workspace_url: "   " })).status).toBe(400);
  });

  it("returns 404 when the repo does not belong to this challenge, without joining the challenge team", async () => {
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue(null);
    h.teamRepo.findByChallenge.mockResolvedValue([]);

    const { status } = await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://github.com/a/b" });

    expect(status).toBe(404);
    expect(h.teamRepo.create).not.toHaveBeenCalled();
  });

  it("adds the user to the challenge team when they are not already a member", async () => {
    h.teamRepo.findByChallenge.mockResolvedValue([]);
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
    h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });

    await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://github.com/a/b" });

    expect(h.teamRepo.create).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: USER_ID });
  });

  it("does not re-add the user to the team when already a member", async () => {
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
    h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });

    await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://github.com/a/b" });

    expect(h.teamRepo.create).not.toHaveBeenCalled();
  });

  it("saves the workspace_url, creates a new contribution and schedules the ML award", async () => {
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
    h.challengeRepoRepo.updateWorkspace.mockResolvedValue({
      repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } },
    });
    h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([
      { repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } } },
    ]);
    h.contributionRepo.create.mockResolvedValue({ uuid: "contrib-1" });

    const { status, body } = await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://github.com/a/b" });

    expect(status).toBe(200);
    expect(body.repo.workspace_meta.userUrls[USER_ID]).toBe("https://github.com/a/b");
    expect(h.contributionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "dataset",
      user_id: USER_ID,
      challenge_id: CHALLENGE_ID,
      artifact_url: "https://github.com/a/b",
      evaluation_status: "pending",
    }));
    expect(h.scheduleAward).toHaveBeenCalledWith({
      challengeId: CHALLENGE_ID,
      userId: USER_ID,
      repoId: "repo-1",
      url: "https://github.com/a/b",
    });
  });

  it("updates the existing contribution instead of creating a new one", async () => {
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
    h.challengeRepoRepo.updateWorkspace.mockResolvedValue({
      repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } },
    });
    h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([
      { repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://github.com/a/b" } } },
    ]);
    h.contributionRepo.findByChallenge.mockResolvedValue([{ uuid: "contrib-1", user_id: USER_ID, type: "dataset" }]);

    await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://github.com/a/b" });

    expect(h.contributionRepo.create).not.toHaveBeenCalled();
    expect(h.contributionRepo.update).toHaveBeenCalledWith("contrib-1", expect.objectContaining({
      evaluation_status: "pending",
      artifact_url: "https://github.com/a/b",
    }));
  });

  it("removes the user url and skips contribution/reward work when workspace_url is null", async () => {
    h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
      repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://old.com" } },
    });
    h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: {} } });

    const { status } = await patchWorkspace({ repo_id: "repo-1", workspace_url: null });

    expect(status).toBe(200);
    expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
      workspace_meta: { userUrls: {} },
    });
    expect(h.contributionRepo.create).not.toHaveBeenCalled();
    expect(h.contributionRepo.update).not.toHaveBeenCalled();
    expect(h.scheduleAward).not.toHaveBeenCalled();
  });

  describe("metric block threshold", () => {
    // Des règles ML valides : reward_rules passe par parseMlRewardRules.
    const withThreshold = (threshold: number) => ({
      version: 1,
      dataset: { cap: 300 },
      model: { cap: 500, metric: { name: "auc", baseline: 0, blockThreshold: threshold }, beatBestBonus: 50 },
      apiPackaging: { cap: 200 },
      reuse: { datasetShare: 0.2, modelShare: 0.2 },
    });

    it("returns 403 for a dataset submission once the best metric reaches the threshold", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.9);

      const { status } = await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://kaggle.com/datasets/a/b" }, withThreshold(0.9));

      expect(status).toBe(403);
      expect(h.contributionRepo.create).not.toHaveBeenCalled();
      expect(h.scheduleAward).not.toHaveBeenCalled();
    });

    it("returns 403 for a model submission once the best metric reaches the threshold", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-model", role: "model", workspace_meta: {} });
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.95);

      expect((await patchWorkspace({ repo_id: "repo-model", workspace_url: "https://kaggle.com/models/a/b" }, withThreshold(0.9))).status).toBe(403);
    });

    it("returns 403 for a model_code submission once the best metric reaches the threshold", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-code", role: "model_code", workspace_meta: {} });
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.9);

      expect((await patchWorkspace({ repo_id: "repo-code", workspace_url: "https://github.com/a/b" }, withThreshold(0.9))).status).toBe(403);
    });

    it("still accepts an api submission once the threshold is reached", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-api", role: "api", workspace_meta: {} });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-api", role: "api", workspace_meta: {} });
      h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([{ repo_id: "repo-api", role: "api", workspace_meta: {} }]);
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.95);

      expect((await patchWorkspace({ repo_id: "repo-api", workspace_url: "https://github.com/a/api" }, withThreshold(0.9))).status).toBe(200);
    });

    it("still allows clearing your own dataset submission (workspace_url: null) past the threshold", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
        repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://old.com" } },
      });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.95);

      expect((await patchWorkspace({ repo_id: "repo-1", workspace_url: null }, withThreshold(0.9))).status).toBe(200);
    });

    it("still allows toggling a community dataset pick (dataset_urls) past the threshold", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.95);

      expect((await patchWorkspace({ repo_id: "repo-1", dataset_urls: ["https://kaggle.com/datasets/a/b"] }, withThreshold(0.9))).status).toBe(200);
    });

    it("allows a dataset submission when a threshold is configured but not yet reached", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([{ repo_id: "repo-1", role: "dataset", workspace_meta: {} }]);
      h.rewardRepo.maxMetaNumber.mockResolvedValue(0.8);

      expect((await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://kaggle.com/datasets/a/b" }, withThreshold(0.9))).status).toBe(200);
    });

    it("allows a dataset submission when no threshold is configured at all", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([{ repo_id: "repo-1", role: "dataset", workspace_meta: {} }]);

      const { status } = await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://kaggle.com/datasets/a/b" });

      expect(status).toBe(200);
      expect(h.rewardRepo.maxMetaNumber).not.toHaveBeenCalled();
    });
  });

  describe("dataset_urls — community multi-select", () => {
    it("returns 400 when dataset_urls is not an array of non-empty strings", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });

      expect((await patchWorkspace({ repo_id: "repo-1", dataset_urls: ["ok", ""] })).status).toBe(400);
    });

    it("returns 400 when dataset_urls targets a non-dataset repo", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "model", workspace_meta: {} });

      expect((await patchWorkspace({ repo_id: "repo-1", dataset_urls: ["https://kaggle.com/datasets/a/b"] })).status).toBe(400);
    });

    it("stores the set under workspace_meta.datasetUrls without touching userUrls, the contribution or scheduleAward", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({
        repo_id: "repo-1", role: "dataset",
        workspace_meta: { datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/alice/a"] } },
      });

      const { status } = await patchWorkspace({ repo_id: "repo-1", dataset_urls: ["https://kaggle.com/datasets/alice/a"] });

      expect(status).toBe(200);
      expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
        workspace_meta: { datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/alice/a"] } },
      });
      expect(h.contributionRepo.create).not.toHaveBeenCalled();
      expect(h.contributionRepo.update).not.toHaveBeenCalled();
      expect(h.scheduleAward).not.toHaveBeenCalled();
    });

    it("dedupes urls and clears the key when the array is empty", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
        repo_id: "repo-1", role: "dataset",
        workspace_meta: { datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/alice/a"] } },
      });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: { datasetUrls: {} } });

      const { status } = await patchWorkspace({ repo_id: "repo-1", dataset_urls: [] });

      expect(status).toBe(200);
      expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
        workspace_meta: { datasetUrls: {} },
      });
    });

    it("preserves other users' picks when updating this one", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
        repo_id: "repo-1", role: "dataset",
        workspace_meta: { datasetUrls: { "other-user": ["https://kaggle.com/datasets/dave/d"] } },
      });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });

      await patchWorkspace({ repo_id: "repo-1", dataset_urls: ["https://kaggle.com/datasets/alice/a"] });

      expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
        workspace_meta: {
          datasetUrls: {
            "other-user": ["https://kaggle.com/datasets/dave/d"],
            [USER_ID]: ["https://kaggle.com/datasets/alice/a"],
          },
        },
      });
    });

    it("syncs datasetUrls when the own workspace_url is submitted, keeping community picks already checked", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
        repo_id: "repo-1", role: "dataset",
        workspace_meta: {
          userUrls: { [USER_ID]: "https://kaggle.com/datasets/old/mine" },
          datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/old/mine", "https://kaggle.com/datasets/alice/a"] },
        },
      });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });
      h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([
        { repo_id: "repo-1", role: "dataset", workspace_meta: { userUrls: { [USER_ID]: "https://kaggle.com/datasets/new/mine" } } },
      ]);
      h.contributionRepo.create.mockResolvedValue({ uuid: "contrib-1" });

      await patchWorkspace({ repo_id: "repo-1", workspace_url: "https://kaggle.com/datasets/new/mine" });

      expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
        workspace_meta: {
          userUrls: { [USER_ID]: "https://kaggle.com/datasets/new/mine" },
          datasetUrls: {
            [USER_ID]: expect.arrayContaining([
              "https://kaggle.com/datasets/new/mine",
              "https://kaggle.com/datasets/alice/a",
            ]),
          },
        },
      });
    });

    it("drops the own entry from datasetUrls when workspace_url is cleared, keeping community picks", async () => {
      h.challengeRepoRepo.findByChallengeAndRepo.mockResolvedValue({
        repo_id: "repo-1", role: "dataset",
        workspace_meta: {
          userUrls: { [USER_ID]: "https://kaggle.com/datasets/old/mine" },
          datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/old/mine", "https://kaggle.com/datasets/alice/a"] },
        },
      });
      h.challengeRepoRepo.updateWorkspace.mockResolvedValue({ repo_id: "repo-1", role: "dataset", workspace_meta: {} });

      await patchWorkspace({ repo_id: "repo-1", workspace_url: null });

      expect(h.challengeRepoRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "repo-1", {
        workspace_meta: {
          userUrls: {},
          datasetUrls: { [USER_ID]: ["https://kaggle.com/datasets/alice/a"] },
        },
      });
    });
  });
});
