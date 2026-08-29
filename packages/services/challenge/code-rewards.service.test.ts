import { describe, it, expect, vi } from "vitest";
import { CodeRewardsService, PROJECT_CONTRIBUTION_TYPE, resolveWorkspaceTarget } from "./code-rewards.service.js";
import type { Challenge, ChallengeTeam, Contribution, Task, RewardEntry, ChallengeRepo } from "../../database-service/domain/entities.js";

const CH = "ch-1", ALICE = "alice";

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: CH, title: "Build the app", status: "active", type: "code",
    contribution_points_reward: 200, completion: 0, project_id: "p-1",
    workspace_mode: "provided_repo",
    reward_rules: { version: 1, delivery: { fixed: 50, cap: 150 } },
    ...over,
  };
}

function makeParticipation(over: Partial<ChallengeTeam> = {}): ChallengeTeam {
  return {
    challenge_id: CH, user_id: ALICE,
    workspace_provider: "github",
    workspace_ref: "refs/heads/contrib/001-alice",
    workspace_url: "https://github.com/org/repo/tree/contrib/001-alice",
    workspace_status: "ready",
    ...over,
  };
}

function makeTask(status: Task["status"]): Task {
  return { uuid: `t-${Math.random()}`, challenge_id: CH, user_id: ALICE, title: "x", status, created_at: new Date() };
}

function makeDeps(opts: {
  challenge?: Partial<Challenge> | null;
  participation?: Partial<ChallengeTeam> | null;
  tasks?: Task[];
  contributions?: Contribution[];
  existingEntries?: Partial<RewardEntry>[];
  distributed?: number;
  score10?: number;
  agentFails?: boolean;
  challengeRepos?: Array<ChallengeRepo & { repo_type: string; repo_external_id?: string; repo_title: string }>;
} = {}) {
  const contributions: Contribution[] = [...(opts.contributions ?? [])];
  const created: Contribution[] = [];
  const updates: Array<{ uuid: string; patch: Record<string, unknown> }> = [];
  const written: unknown[][] = [];
  const challengeUpdates: Array<Record<string, unknown>> = [];

  const deps = {
    challengeRepo: {
      findById: vi.fn(async () => (opts.challenge === null ? null : makeChallenge(opts.challenge))),
      update: vi.fn(async (_id: string, patch: Record<string, unknown>) => { challengeUpdates.push(patch); return makeChallenge(); }),
    },
    challengeTeamRepo: {
      findByChallengeAndUser: vi.fn(async () =>
        opts.participation === null ? null : makeParticipation(opts.participation)),
    },
    challengeRepoRepo: {
      findByChallengeWithRepo: vi.fn(async () => opts.challengeRepos ?? []),
    },
    taskRepo: { findPersonalTasks: vi.fn(async () => opts.tasks ?? [makeTask("done")]) },
    contributionRepo: {
      findByChallenge: vi.fn(async () => [...contributions, ...created]),
      create: vi.fn(async (c: Omit<Contribution, "uuid">) => {
        const row = { ...c, uuid: `contrib-${created.length + 1}` } as Contribution;
        created.push(row); return row;
      }),
      update: vi.fn(async (uuid: string, patch: Record<string, unknown>) => {
        updates.push({ uuid, patch });
        return { ...(contributions.find(c => c.uuid === uuid) ?? created.find(c => c.uuid === uuid)), ...patch } as Contribution;
      }),
    },
    rewardRepo: {
      findByUserAndChallenge: vi.fn(async () => (opts.existingEntries ?? []) as RewardEntry[]),
      // Somme dynamique : le "distributed" initial + tout ce que le service a
      // écrit pendant le run — sinon le recalcul de completion lirait 0.
      sumByChallenge: vi.fn(async () =>
        (opts.distributed ?? 0) +
        written.flat().reduce((s: number, d) => s + (d as { points: number }).points, 0)),
      createManyAndSyncRewards: vi.fn(async (drafts: unknown[]) => { written.push(drafts); return drafts as RewardEntry[]; }),
    },
    runAgent: vi.fn(async () => {
      if (opts.agentFails) throw new Error("agent down");
      return { score10: opts.score10 ?? 8, evaluation: { globalScore: 7.2, scores: [] } };
    }),
  };
  return { deps, written, updates, created, challengeUpdates };
}

describe("canEvaluate", () => {
  it("refuses a non-participant", async () => {
    const { deps } = makeDeps({ participation: null });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "not_participant" });
  });

  it("refuses an empty board", async () => {
    const { deps } = makeDeps({ tasks: [] });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "no_tasks" });
  });

  it("refuses while a task is not done", async () => {
    const { deps } = makeDeps({ tasks: [makeTask("done"), makeTask("in_progress")] });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "tasks_not_done" });
  });

  it("refuses an own_repo participant without a repo URL", async () => {
    const { deps } = makeDeps({
      challenge: { workspace_mode: "own_repo" },
      participation: { workspace_provider: "external", workspace_ref: undefined, workspace_url: undefined, workspace_status: undefined },
    });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "workspace_not_ready" });
  });

  it("refuses while a run is already running", async () => {
    const { deps } = makeDeps({
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 0,
        user_id: ALICE, challenge_id: CH, evaluation_status: "running", submitted_at: new Date(),
      } as Contribution],
    });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "already_running" });
  });

  it("accepts a complete board with a ready workspace", async () => {
    const { deps } = makeDeps();
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: true });
  });

  it.each(["completed", "archived"] as const)("refuses a %s challenge", async (status) => {
    const { deps } = makeDeps({ challenge: { status } });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "challenge_closed" });
  });
});

describe("evaluate", () => {
  it("first run: creates the project contribution and pays fixed + quality", async () => {
    const { deps, written, updates } = makeDeps({ score10: 8 });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(deps.contributionRepo.create).toHaveBeenCalledOnce();
    const drafts = written[0] as Array<{ rule_key: string; points: number }>;
    expect(drafts.map(d => [d.rule_key, d.points])).toEqual([
      ["code_fixed", 50],
      ["code_quality", 120],
    ]);
    // Premier run : le statut running est posé À LA CRÉATION de la
    // contribution (pas via update) ; seul le passage à done est un update.
    expect(deps.contributionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ evaluation_status: "running" })
    );
    const statuses = updates.map(u => u.patch.evaluation_status).filter(Boolean);
    expect(statuses[statuses.length - 1]).toBe("done");
  });

  it("re-run pays only the positive delta read from the ledger", async () => {
    const { deps, written } = makeDeps({
      score10: 9,
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 170,
        user_id: ALICE, challenge_id: CH, evaluation_status: "done", submitted_at: new Date(),
      } as Contribution],
      existingEntries: [
        { rule_key: "code_fixed", points: 50 },
        { rule_key: "code_quality", points: 120 },
      ],
      distributed: 170,
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    const drafts = written[0] as Array<{ rule_key: string; points: number }>;
    expect(drafts).toEqual([expect.objectContaining({ rule_key: "code_quality", points: 15 })]);
  });

  it("worse score writes no ledger rows but still stores the evaluation", async () => {
    const { deps, written, updates } = makeDeps({
      score10: 5,
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 170,
        user_id: ALICE, challenge_id: CH, evaluation_status: "done", submitted_at: new Date(),
      } as Contribution],
      existingEntries: [
        { rule_key: "code_fixed", points: 50 },
        { rule_key: "code_quality", points: 120 },
      ],
      distributed: 170,
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    expect(written).toHaveLength(0); // createManyAndSyncRewards jamais appelé avec des drafts
    expect(updates.some(u => u.patch.evaluation === undefined ? false : true)).toBe(true);
    expect(updates[updates.length - 1].patch.evaluation_status).toBe("done");
  });

  it("updates challenge completion from the drained pool", async () => {
    const { deps, challengeUpdates } = makeDeps({ score10: 10, distributed: 0 });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    // 50 + 150 versés sur un pool de 200 → completion 1
    expect(challengeUpdates[challengeUpdates.length - 1].completion).toBe(1);
  });

  it("agent failure marks the contribution failed and rethrows", async () => {
    const { deps, updates } = makeDeps({ agentFails: true });
    await expect(new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE }))
      .rejects.toThrow("agent down");
    expect(updates[updates.length - 1].patch.evaluation_status).toBe("failed");
  });

  it("skips silently when the project contribution is already running", async () => {
    const { deps, written, updates } = makeDeps({
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 0,
        user_id: ALICE, challenge_id: CH, evaluation_status: "running", submitted_at: new Date(),
      } as Contribution],
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(deps.runAgent).not.toHaveBeenCalled();
    expect(written).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(deps.contributionRepo.create).not.toHaveBeenCalled();
  });

  it("github mode with an unparseable workspace_url falls back to challenge_repos", async () => {
    const { deps } = makeDeps({
      participation: { workspace_url: undefined },
      challengeRepos: [{
        challenge_id: CH, repo_id: "repo-1", repo_type: "github", repo_external_id: "org/repo", repo_title: "repo",
      }],
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(deps.challengeRepoRepo.findByChallengeWithRepo).toHaveBeenCalledWith(CH);
    expect(deps.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "org/repo" })
    );
  });
});

describe("resolveWorkspaceTarget", () => {
  it("github mode: challenge repo slug + branch from the personal ref", () => {
    expect(resolveWorkspaceTarget(makeParticipation(), "org/repo"))
      .toEqual({ slug: "org/repo", branch: "contrib/001-alice" });
  });
  it("external mode: parses owner/repo and optional /tree/branch from the URL", () => {
    const p = makeParticipation({ workspace_provider: "external", workspace_url: "https://github.com/alice/app/tree/main", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p, undefined)).toEqual({ slug: "alice/app", branch: "main" });
    const p2 = makeParticipation({ workspace_provider: "external", workspace_url: "https://github.com/alice/app", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p2, undefined)).toEqual({ slug: "alice/app", branch: undefined });
  });
  it("returns null when nothing usable", () => {
    const p = makeParticipation({ workspace_provider: "external", workspace_url: "https://gitlab.com/x/y", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p, undefined)).toBeNull();
  });
});
