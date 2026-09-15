import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

// La transaction n'est jamais ouverte par les refus testés ici : la doublure le vérifie.
vi.mock("../../database-service/db/drizzle.js", () => ({
  db: { transaction: h.transaction },
  challenge_repos: {},
  challenge_teams: {},
  challenges: {},
  repos: {},
  sandbox_rewards: {},
  sandboxes: {},
}));
vi.mock("../../database-service/repositories/index.js", () => ({
  ChallengeRepository: class {},
  SandboxRepository: class {},
}));

import { SandboxPromotionService } from "./sandbox-promotion.service.js";
import { SandboxForbiddenError, SandboxNotFoundError } from "./sandbox.service.js";
import { SandboxFlowUnavailableError } from "./proposal.js";
import type { Sandbox } from "../../database-service/domain/entities.js";

const ADMIN = { userId: "admin-1", role: "admin" };
const INPUT = { status: "active", contribution_points_reward: 500, project_id: "11111111-1111-4111-8111-111111111111" };

function makeService(sandbox: Partial<Sandbox> | null) {
  const deps = {
    sandboxRepo: { findById: vi.fn(async () => (sandbox ? ({ uuid: "sb-1", type: "code", ...sandbox } as Sandbox) : null)) },
    challengeRepo: { isSlugTaken: vi.fn(), availableSlug: vi.fn() },
    settings: vi.fn(async () => ({ promotion_bonus_cp: 100 })),
    // Aucun flow installé n'accepte de propositions : c'est le cas testé.
    proposable: vi.fn(() => undefined),
  };
  return { service: new SandboxPromotionService(deps), deps };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SandboxPromotionService.promote — refusals", () => {
  it("refuses anyone but an admin, before reading anything", async () => {
    const { service, deps } = makeService({});

    await expect(
      service.promote({ sandboxId: "sb-1", actor: { userId: "u1", role: "contributor" }, input: INPUT }),
    ).rejects.toBeInstanceOf(SandboxForbiddenError);
    expect(deps.sandboxRepo.findById).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown sandbox", async () => {
    const { service } = makeService(null);

    await expect(service.promote({ sandboxId: "sb-1", actor: ADMIN, input: INPUT })).rejects.toBeInstanceOf(
      SandboxNotFoundError,
    );
  });

  it("refuses a sandbox whose flow is not installed or no longer accepts proposals, without writing", async () => {
    const { service, deps } = makeService({ type: "retired" });

    const error = await service.promote({ sandboxId: "sb-1", actor: ADMIN, input: INPUT }).catch((e) => e);

    expect(error).toBeInstanceOf(SandboxFlowUnavailableError);
    expect(error.message).toContain('flow "retired"');
    expect(deps.proposable).toHaveBeenCalledWith("retired");
    expect(deps.challengeRepo.availableSlug).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });
});
