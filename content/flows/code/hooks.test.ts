import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  challengeRepoRepo: { findByChallengeWithRepo: vi.fn() },
  challengeTeamRepo: { updateWorkspace: vi.fn(), findByGroup: vi.fn(), findByChallenge: vi.fn() },
  userRepo: { findById: vi.fn() },
  provisionContributorWorkspace: vi.fn(),
  getProvider: vi.fn(),
  protect: vi.fn(),
}));

vi.mock("../../../packages/database-service/repositories/index.js", () => ({
  ChallengeRepoRepository: class {
    constructor() {
      return h.challengeRepoRepo;
    }
  },
  ChallengeTeamRepository: class {
    constructor() {
      return h.challengeTeamRepo;
    }
  },
  UserRepository: class {
    constructor() {
      return h.userRepo;
    }
  },
}));

vi.mock("../../../packages/provisioner/src/index.js", () => ({
  provisionContributorWorkspace: (...args: unknown[]) => h.provisionContributorWorkspace(...args),
  ProvisionerRegistry: { getProvider: (...args: unknown[]) => h.getProvider(...args) },
  mapRepoTypeToWorkspaceType: () => "git_branch",
}));

import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { provisionWorkspace, reprotectGroupBranch } from "./hooks.js";

const CHALLENGE_ID = "challenge-1";
const GROUP = "11111111-1111-4111-8111-111111111111";
const CODE_REPO = { challenge_id: CHALLENGE_ID, repo_id: "repo-1", repo_type: "github", repo_external_id: "acme/widgets", workspace_ref: "refs/heads/challenge/3" };

function challenge(workspace_mode = "provided_repo"): Challenge {
  return { uuid: CHALLENGE_ID, type: "code", index: 3, flow_config: { workspace_mode } } as Challenge;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.challengeTeamRepo.updateWorkspace.mockResolvedValue({});
  h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([CODE_REPO]);
  h.userRepo.findById.mockResolvedValue({ uuid: "alice", full_name: "Alice", github_username: "alice-gh" });
  h.provisionContributorWorkspace.mockResolvedValue({
    ref: "refs/heads/contrib/3-alice-gh",
    url: "https://github.com/acme/repo/tree/contrib/3-alice-gh",
    status: "ready",
  });
  h.getProvider.mockReturnValue({ protect: h.protect });
  h.protect.mockResolvedValue(undefined);
  h.challengeTeamRepo.findByGroup.mockResolvedValue([]);
});

describe("provisionWorkspace", () => {
  it("provided_repo: marks the workspace pending, provisions the personal branch and protects it", async () => {
    await provisionWorkspace({ challenge: challenge(), userId: "alice", groupId: null });

    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenNthCalledWith(1, CHALLENGE_ID, "alice", {
      workspace_provider: "github",
      workspace_status: "pending",
    });
    expect(h.provisionContributorWorkspace).toHaveBeenCalledWith({
      challengeIndex: 3,
      username: "alice-gh",
      repoExternalId: "acme/widgets",
      repoType: "github",
      challengeBranchRef: "refs/heads/challenge/3",
    });
    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenLastCalledWith(CHALLENGE_ID, "alice", {
      workspace_ref: "refs/heads/contrib/3-alice-gh",
      workspace_url: "https://github.com/acme/repo/tree/contrib/3-alice-gh",
      workspace_status: "ready",
    });
    expect(h.protect).toHaveBeenCalledWith("acme/widgets", "refs/heads/contrib/3-alice-gh", ["alice-gh"]);
  });

  it("own_repo: sets workspace_provider external and never calls the provisioner", async () => {
    await provisionWorkspace({ challenge: challenge("own_repo"), userId: "alice", groupId: null });

    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenCalledOnce();
    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, "alice", { workspace_provider: "external" });
    expect(h.provisionContributorWorkspace).not.toHaveBeenCalled();
    expect(h.challengeRepoRepo.findByChallengeWithRepo).not.toHaveBeenCalled();
  });

  it("marks the workspace failed when the challenge has no GitHub repo", async () => {
    h.challengeRepoRepo.findByChallengeWithRepo.mockResolvedValue([]);

    await provisionWorkspace({ challenge: challenge(), userId: "alice", groupId: null });

    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenLastCalledWith(CHALLENGE_ID, "alice", { workspace_status: "failed" });
    expect(h.provisionContributorWorkspace).not.toHaveBeenCalled();
  });

  it("marks the workspace failed when provisioning fails, without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.provisionContributorWorkspace.mockRejectedValue(new Error("GitHub API down"));

    await expect(provisionWorkspace({ challenge: challenge(), userId: "alice", groupId: null })).resolves.toBeUndefined();

    expect(h.challengeTeamRepo.updateWorkspace).toHaveBeenLastCalledWith(CHALLENGE_ID, "alice", { workspace_status: "failed" });
    spy.mockRestore();
  });
});

describe("reprotectGroupBranch", () => {
  it("reopens the holder's branch to every member", async () => {
    h.challengeTeamRepo.findByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: "alice", group_id: GROUP, workspace_ref: "refs/heads/contrib/003-alice" },
      { challenge_id: CHALLENGE_ID, user_id: "bob", group_id: GROUP },
    ]);
    h.userRepo.findById.mockImplementation(async (id: string) => ({ uuid: id, full_name: id, github_username: `${id}-gh` }));

    const report = await reprotectGroupBranch({ challenge: challenge(), userId: "bob", groupId: GROUP });

    expect(h.protect).toHaveBeenCalledWith("acme/widgets", "refs/heads/contrib/003-alice", ["alice-gh", "bob-gh"]);
    expect(report).toEqual({ missingGithub: [] });
  });

  it("reports members who cannot push for lack of a GitHub account", async () => {
    h.challengeTeamRepo.findByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: "alice", group_id: GROUP, workspace_ref: "refs/heads/contrib/003-alice" },
      { challenge_id: CHALLENGE_ID, user_id: "bob", group_id: GROUP },
    ]);
    h.userRepo.findById.mockImplementation(async (id: string) =>
      id === "bob" ? { uuid: id, full_name: "Bob" } : { uuid: id, full_name: "Alice", github_username: "alice-gh" });

    const report = await reprotectGroupBranch({ challenge: challenge(), userId: "bob", groupId: GROUP });

    // Sans ça, Bob découvrirait son 403 au premier push.
    expect(report).toEqual({ missingGithub: ["Bob"] });
  });

  it("does nothing while the holder has no branch yet", async () => {
    h.challengeTeamRepo.findByGroup.mockResolvedValue([{ challenge_id: CHALLENGE_ID, user_id: "alice", group_id: GROUP }]);

    expect(await reprotectGroupBranch({ challenge: challenge(), userId: "bob", groupId: GROUP })).toEqual({ missingGithub: [] });
    expect(h.protect).not.toHaveBeenCalled();
  });
});
