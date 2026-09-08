import { describe, it, expect, vi } from "vitest";
import {
  GROUP_MAX_SIZE,
  getGroupContext,
  groupContextFrom,
  groupMultiplier,
  pickGroupOwner,
  resolveWorkspaceOwner,
} from "./group.js";
import type { ChallengeTeam } from "../../database-service/domain/entities.js";

const CH = "ch-1";
const ALICE = "aaa-alice";
const BOB = "bbb-bob";
const CAROL = "ccc-carol";
const GROUP = "grp-1";

/** Participation solo par défaut ; `over` la transforme en membre de groupe. */
function member(userId: string, over: Partial<ChallengeTeam> = {}): ChallengeTeam {
  return { challenge_id: CH, user_id: userId, ...over };
}

/** Le porteur : celui dont la branche a été provisionnée au moment du join. */
function owner(userId: string, over: Partial<ChallengeTeam> = {}): ChallengeTeam {
  return member(userId, {
    workspace_provider: "github",
    workspace_ref: `refs/heads/contrib/001-${userId}`,
    workspace_url: `https://github.com/org/repo/tree/contrib/001-${userId}`,
    workspace_status: "ready",
    ...over,
  });
}

function deps(participants: ChallengeTeam[]) {
  return {
    challengeTeamRepo: { findByChallenge: vi.fn(async () => participants) },
  };
}

describe("groupMultiplier", () => {
  it("gives no bonus to a lone participant", () => {
    expect(groupMultiplier(1)).toBe(1);
  });

  it("adds 0.4 per extra member", () => {
    expect(groupMultiplier(2)).toBeCloseTo(1.4, 10);
    expect(groupMultiplier(3)).toBeCloseTo(1.8, 10);
  });

  it("keeps every member below their solo value", () => {
    // C'est la propriété qui rend le groupe économe pour le pool : à n
    // membres, le groupe coûte moins que n contributeurs solo.
    for (let n = 2; n <= GROUP_MAX_SIZE; n++) {
      expect(groupMultiplier(n)).toBeLessThan(n);
      expect(groupMultiplier(n) / n).toBeLessThan(1);
    }
  });

  it("caps past the max size, even if a row escapes the join check", () => {
    expect(groupMultiplier(GROUP_MAX_SIZE + 1)).toBeCloseTo(groupMultiplier(GROUP_MAX_SIZE), 10);
    expect(groupMultiplier(99)).toBeCloseTo(groupMultiplier(GROUP_MAX_SIZE), 10);
  });

  it("treats an absurd size as solo rather than returning a negative bonus", () => {
    expect(groupMultiplier(0)).toBe(1);
    expect(groupMultiplier(-3)).toBe(1);
  });
});

describe("pickGroupOwner", () => {
  it("picks the member whose branch was provisioned", () => {
    expect(pickGroupOwner([member(ALICE), owner(BOB), member(CAROL)])).toBe(BOB);
  });

  it("falls back to the declared repo when no branch exists (own_repo mode)", () => {
    const declared = member(CAROL, { workspace_provider: "external", workspace_url: "https://github.com/carol/x" });
    expect(pickGroupOwner([member(ALICE), declared])).toBe(CAROL);
  });

  it("stays deterministic while provisioning is pending or failed", () => {
    const pending = [member(CAROL), member(ALICE), member(BOB)];
    expect(pickGroupOwner(pending)).toBe(ALICE);
    // Même réponse quel que soit l'ordre des rows renvoyées par la base :
    // sans ça, deux lectures successives désigneraient deux porteurs.
    expect(pickGroupOwner([...pending].reverse())).toBe(ALICE);
  });

  it("is not swayed by a workspace_url when a branch exists", () => {
    const withUrlOnly = member(ALICE, { workspace_url: "https://github.com/alice/x" });
    expect(pickGroupOwner([withUrlOnly, owner(CAROL)])).toBe(CAROL);
  });
});

describe("getGroupContext", () => {
  it("makes a solo contributor their own owner", async () => {
    const ctx = await getGroupContext(CH, ALICE, deps([owner(ALICE), owner(BOB)]));
    expect(ctx).toEqual({ ownerId: ALICE, groupId: null, memberIds: [ALICE], multiplier: 1 });
  });

  it("treats a non-participant as solo", async () => {
    // Les appelants qui exigent une participation la vérifient déjà ;
    // renvoyer null ici leur imposerait un cas de plus à gérer.
    const ctx = await getGroupContext(CH, CAROL, deps([owner(ALICE)]));
    expect(ctx.ownerId).toBe(CAROL);
    expect(ctx.groupId).toBeNull();
  });

  it("points every group member at the owner", async () => {
    const participants = [owner(ALICE, { group_id: GROUP }), member(BOB, { group_id: GROUP })];

    const fromOwner = await getGroupContext(CH, ALICE, deps(participants));
    const fromMember = await getGroupContext(CH, BOB, deps(participants));

    expect(fromOwner.ownerId).toBe(ALICE);
    expect(fromMember.ownerId).toBe(ALICE);
    expect(fromMember.groupId).toBe(GROUP);
    expect(fromMember.memberIds.sort()).toEqual([ALICE, BOB]);
    expect(fromMember.multiplier).toBeCloseTo(1.4, 10);
  });

  it("ignores solo participants and other groups on the same challenge", async () => {
    const ctx = await getGroupContext(CH, BOB, deps([
      owner(ALICE, { group_id: GROUP }),
      member(BOB, { group_id: GROUP }),
      owner(CAROL),                                    // solo
      owner("ddd-dan", { group_id: "grp-2" }),         // autre groupe
    ]));

    expect(ctx.memberIds.sort()).toEqual([ALICE, BOB]);
    expect(ctx.multiplier).toBeCloseTo(1.4, 10);
  });

  it("gives no bonus to a group nobody has joined yet", async () => {
    // Le créateur a cliqué "Participer en groupe" mais partagé son lien à
    // personne : il travaille seul, il doit être payé comme un solo. Le
    // groupId reste posé pour que le lien fonctionne toujours.
    const ctx = await getGroupContext(CH, ALICE, deps([owner(ALICE, { group_id: GROUP })]));
    expect(ctx.groupId).toBe(GROUP);
    expect(ctx.memberIds).toEqual([ALICE]);
    expect(ctx.multiplier).toBe(1);
  });

  it("raises the multiplier with the group size", async () => {
    const ctx = await getGroupContext(CH, CAROL, deps([
      owner(ALICE, { group_id: GROUP }),
      member(BOB, { group_id: GROUP }),
      member(CAROL, { group_id: GROUP }),
    ]));
    expect(ctx.memberIds).toHaveLength(3);
    expect(ctx.multiplier).toBeCloseTo(1.8, 10);
  });

  it("reads the table only once", async () => {
    // Le scoring et les routes de tâches sont sur le chemin chaud : owner,
    // composition et multiplicateur doivent sortir d'une seule requête.
    const d = deps([owner(ALICE, { group_id: GROUP }), member(BOB, { group_id: GROUP })]);
    await getGroupContext(CH, BOB, d);
    expect(d.challengeTeamRepo.findByChallenge).toHaveBeenCalledTimes(1);
  });
});

describe("resolveWorkspaceOwner", () => {
  it("returns the caller when solo and the holder when grouped", async () => {
    const solo = deps([owner(ALICE)]);
    await expect(resolveWorkspaceOwner(CH, ALICE, solo)).resolves.toBe(ALICE);

    const grouped = deps([owner(ALICE, { group_id: GROUP }), member(BOB, { group_id: GROUP })]);
    await expect(resolveWorkspaceOwner(CH, BOB, grouped)).resolves.toBe(ALICE);
  });
});

describe("groupContextFrom", () => {
  it("matches getGroupContext without touching the repository", async () => {
    // L'overview a déjà challenge_teams en main : relire la table pour
    // désigner le porteur serait une requête pour rien.
    const participants = [owner(ALICE, { group_id: GROUP }), member(BOB, { group_id: GROUP })];
    const d = deps(participants);

    expect(groupContextFrom(participants, BOB)).toEqual(await getGroupContext(CH, BOB, d));
  });

  it("returns a solo context for someone absent from the list", async () => {
    expect(groupContextFrom([owner(ALICE)], CAROL)).toEqual({
      ownerId: CAROL, groupId: null, memberIds: [CAROL], multiplier: 1,
    });
  });

  it("handles an empty participant list", () => {
    expect(groupContextFrom([], ALICE).ownerId).toBe(ALICE);
  });
});
