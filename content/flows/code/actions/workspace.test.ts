import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  teamRepo: { updateWorkspace: vi.fn(), findByChallenge: vi.fn(), findByChallengeAndUser: vi.fn() },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ChallengeTeamRepository: class {
    constructor() {
      return h.teamRepo;
    }
  },
}));

import { actionContext } from "../../../../packages/capabilities/testing/action-context.js";
import { setOwnRepo } from "./workspace.js";
import { codeFlow } from "../index.js";

const CHALLENGE_ID = "challenge-1";
const USER_ID = "user-1";

const patch = (body: unknown, flowConfig: Record<string, unknown> = { workspace_mode: "own_repo" }) =>
  setOwnRepo(
    actionContext({
      challenge: { uuid: CHALLENGE_ID, type: "code", flow_config: flowConfig },
      user: { id: USER_ID },
      method: "PATCH",
      body,
    }),
  );

async function read(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.teamRepo.updateWorkspace.mockResolvedValue({ uuid: "membership-1", workspace_url: "https://github.com/acme/repo" });
  // Lue par resolveWorkspaceOwner : vide = personne en groupe.
  h.teamRepo.findByChallenge.mockResolvedValue([]);
  h.teamRepo.findByChallengeAndUser.mockResolvedValue({ uuid: "membership-1", challenge_id: CHALLENGE_ID, user_id: USER_ID });
});

describe("PATCH workspace — declared access", () => {
  it("is reserved to the challenge's participants", () => {
    expect(codeFlow.actions?.find((a) => a.method === "PATCH" && a.path === "workspace")?.access).toEqual({ member: true });
  });
});

describe("PATCH workspace", () => {
  it("returns 400 when the challenge does not accept contributor repos", async () => {
    const { status } = await read(await patch({ repo_url: "https://github.com/acme/repo" }, { workspace_mode: "provided_repo" }));

    expect(status).toBe(400);
    expect(h.teamRepo.updateWorkspace).not.toHaveBeenCalled();
  });

  it("returns 400 when repo_url is not a github.com URL", async () => {
    const { status } = await read(await patch({ repo_url: "https://gitlab.com/acme/repo" }));

    expect(status).toBe(400);
    expect(h.teamRepo.updateWorkspace).not.toHaveBeenCalled();
  });

  it("updates the workspace with a trimmed external repo url on success", async () => {
    const { status, body } = await read(await patch({ repo_url: "  https://github.com/acme/repo  " }));

    expect(status).toBe(200);
    expect(h.teamRepo.updateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID, {
      workspace_provider: "external",
      workspace_url: "https://github.com/acme/repo",
      workspace_status: "ready",
    });
    expect(body.participation).toEqual({ uuid: "membership-1", workspace_url: "https://github.com/acme/repo" });
  });
});
