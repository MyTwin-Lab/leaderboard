import { describe, it, expect, vi } from "vitest";
import { CodeRewardsService, PROJECT_CONTRIBUTION_TYPE, resolveWorkspaceTarget } from "./code-rewards.service.js";
import type { Challenge, ChallengeTeam, Contribution, Task, RewardEntry, ChallengeRepo } from "../../database-service/domain/entities.js";
import { EVALUATION_STALE_AFTER_MS, isEvaluationRunning } from "../../database-service/repositories/contribution.repo.js";

const CH = "ch-1", ALICE = "alice";

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: CH, title: "Build the app", slug: "build-the-app", status: "active", type: "code",
    contribution_points_reward: 200, completion: 0, project_id: "p-1",
    flow_config: { workspace_mode: "provided_repo" },
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
  /** Composition de challenge_teams — c'est elle qui décide solo vs groupe. */
  participants?: ChallengeTeam[];
} = {}) {
  const contributions: Contribution[] = [...(opts.contributions ?? [])];
  const created: Contribution[] = [];
  const updates: Array<{ uuid: string; patch: Record<string, unknown> }> = [];
  const claims: Array<{ uuid: string; patch: Record<string, unknown> }> = [];
  const written: unknown[][] = [];
  const shares: unknown[][] = [];
  const challengeUpdates: Array<Record<string, unknown>> = [];

  const deps = {
    challengeRepo: {
      findById: vi.fn(async () => (opts.challenge === null ? null : makeChallenge(opts.challenge))),
      update: vi.fn(async (_id: string, patch: Record<string, unknown>) => { challengeUpdates.push(patch); return makeChallenge(); }),
    },
    challengeTeamRepo: {
      findByChallengeAndUser: vi.fn(async (_ch: string, userId: string) => {
        if (opts.participants) return opts.participants.find(p => p.user_id === userId) ?? null;
        return opts.participation === null ? null : makeParticipation(opts.participation);
      }),
      // Lue par getGroupContext. Sans `participants`, un unique solo : c'est
      // le cas de tous les tests écrits avant les groupes.
      findByChallenge: vi.fn(async () =>
        opts.participants ??
        (opts.participation === null ? [] : [makeParticipation(opts.participation)])),
    },
    challengeRepoRepo: {
      findByChallengeWithRepo: vi.fn(async () => opts.challengeRepos ?? []),
    },
    taskRepo: { findPersonalTasks: vi.fn(async () => opts.tasks ?? [makeTask("done")]) },
    contributionRepo: {
      findByChallenge: vi.fn(async () => [...contributions, ...created]),
      // Même triplet (challenge, user, type) que findContribution.
      createIfAbsent: vi.fn(async (c: Omit<Contribution, "uuid" | "created_at">) => {
        const existing = [...contributions, ...created].find(r =>
          r.challenge_id === c.challenge_id && r.user_id === c.user_id && r.type === c.type);
        if (existing) return { contribution: existing, created: false };
        const row = { ...c, uuid: `contrib-${created.length + 1}` } as Contribution;
        created.push(row); return { contribution: row, created: true };
      }),
      // Rejoue la garde SQL : prenable, sauf un `running` récent.
      claimEvaluation: vi.fn(async (uuid: string, patch: { artifact_url?: string | null } = {}) => {
        const row = [...contributions, ...created].find(c => c.uuid === uuid);
        if (!row || isEvaluationRunning(row)) return null;
        Object.assign(row, { evaluation_status: "running", submitted_at: new Date() });
        claims.push({ uuid, patch });
        return row;
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
    contributionMemberRepo: {
      addShares: vi.fn(async (rows: unknown[]) => { shares.push(rows); }),
    },
    runAgent: vi.fn(async () => {
      if (opts.agentFails) throw new Error("agent down");
      return { score10: opts.score10 ?? 8, evaluation: { globalScore: 7.2, scores: [] } };
    }),
  };
  return { deps, written, shares, updates, created, claims, challengeUpdates };
}

const EVENT = { challengeId: CH, userId: ALICE };

function projectRow(over: Partial<Contribution> = {}): Contribution {
  return {
    uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 0,
    user_id: ALICE, challenge_id: CH, evaluation_status: "done", submitted_at: new Date(),
    ...over,
  } as Contribution;
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
      challenge: { flow_config: { workspace_mode: "own_repo" } },
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

    expect(deps.contributionRepo.createIfAbsent).toHaveBeenCalledOnce();
    const drafts = written[0] as Array<{ rule_key: string; points: number }>;
    expect(drafts.map(d => [d.rule_key, d.points])).toEqual([
      ["code_fixed", 50],
      ["code_quality", 120],
    ]);
    // Premier run : le statut running est posé À LA CRÉATION de la
    // contribution (ni claim ni update) ; seul le passage à done est un update.
    expect(deps.contributionRepo.claimEvaluation).not.toHaveBeenCalled();
    expect(deps.contributionRepo.createIfAbsent).toHaveBeenCalledWith(
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
    expect(deps.contributionRepo.createIfAbsent).not.toHaveBeenCalled();
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

describe("claim / run", () => {
  it("claims an existing contribution through the compare-and-set, without running the agent", async () => {
    const { deps, claims } = makeDeps({ contributions: [projectRow()] });

    expect(await new CodeRewardsService(deps).claim(EVENT)).toEqual({ ok: true });

    expect(claims).toEqual([{ uuid: "c-1", patch: { artifact_url: makeParticipation().workspace_url } }]);
    expect(deps.contributionRepo.createIfAbsent).not.toHaveBeenCalled();
    expect(deps.runAgent).not.toHaveBeenCalled();
  });

  it("a second claim while the first run is in flight gets already_running", async () => {
    const { deps } = makeDeps({ contributions: [projectRow()] });
    const svc = new CodeRewardsService(deps);

    expect(await svc.claim(EVENT)).toEqual({ ok: true });
    expect(await svc.claim(EVENT)).toEqual({ ok: false, reason: "already_running" });
  });

  it("first run: a second claim finds the freshly created running row", async () => {
    const { deps, created } = makeDeps();
    const svc = new CodeRewardsService(deps);

    expect(await svc.claim(EVENT)).toEqual({ ok: true });
    expect(await svc.claim(EVENT)).toEqual({ ok: false, reason: "already_running" });
    expect(created).toHaveLength(1);
  });

  it("first run: falls back to the compare-and-set when a concurrent call created the row", async () => {
    const { deps } = makeDeps();
    const raced = projectRow({ evaluation_status: "running" });
    deps.contributionRepo.createIfAbsent.mockResolvedValueOnce({ contribution: raced, created: false });

    expect(await new CodeRewardsService(deps).claim(EVENT)).toEqual({ ok: false, reason: "already_running" });
    expect(deps.contributionRepo.claimEvaluation).toHaveBeenCalledWith("c-1", expect.anything());
  });

  it("reclaims a running status left behind by a crashed process", async () => {
    const stale = new Date(Date.now() - EVALUATION_STALE_AFTER_MS - 60_000);
    const { deps } = makeDeps({ contributions: [projectRow({ evaluation_status: "running", submitted_at: stale })] });
    const svc = new CodeRewardsService(deps);

    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: true });
    expect(await svc.claim(EVENT)).toEqual({ ok: true });
  });

  it("refuses a workspace that resolves to no repository, without writing", async () => {
    const { deps } = makeDeps({ participation: { workspace_url: undefined } });

    expect(await new CodeRewardsService(deps).claim(EVENT)).toEqual({ ok: false, reason: "workspace_not_ready" });
    expect(deps.contributionRepo.createIfAbsent).not.toHaveBeenCalled();
    expect(deps.contributionRepo.claimEvaluation).not.toHaveBeenCalled();
  });

  it("run does nothing unless a claim put the contribution in running", async () => {
    const { deps, updates, written } = makeDeps({ contributions: [projectRow()] });

    await new CodeRewardsService(deps).run(EVENT);

    expect(deps.runAgent).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(written).toHaveLength(0);
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

describe("group delivery", () => {
  const BOB = "bob", CAROL = "carol", GROUP = "grp-1";

  /** Alice porte le workspace, les autres n'ont qu'une appartenance. */
  const trio = (): ChallengeTeam[] => [
    makeParticipation({ user_id: ALICE, group_id: GROUP }),
    { challenge_id: CH, user_id: BOB, group_id: GROUP },
    { challenge_id: CH, user_id: CAROL, group_id: GROUP },
  ];
  const pair = (): ChallengeTeam[] => trio().slice(0, 2);

  const totalWritten = (written: unknown[][]) =>
    written.flat().reduce((s: number, d) => s + (d as { points: number }).points, 0);

  it("lets a member without a workspace launch the evaluation", async () => {
    // Bob n'a ni branche ni board : c'est celui du porteur qui est évalué.
    const { deps } = makeDeps({ participants: pair() });
    expect(await new CodeRewardsService(deps).canEvaluate(CH, BOB)).toEqual({ ok: true });
  });

  it("still refuses someone who is not on the challenge at all", async () => {
    const { deps } = makeDeps({ participants: pair() });
    expect(await new CodeRewardsService(deps).canEvaluate(CH, "dan"))
      .toEqual({ ok: false, reason: "not_participant" });
  });

  it("credits the ledger to the holder, whoever launched it", async () => {
    const { deps, written, created } = makeDeps({ participants: pair() });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: BOB });

    expect(created[0].user_id).toBe(ALICE);
    expect(written.flat().every(d => (d as { user_id: string }).user_id === ALICE)).toBe(true);
  });

  it("pays a pair 140% and splits it in half", async () => {
    const { deps, written, shares } = makeDeps({ participants: pair(), challenge: { contribution_points_reward: 2000 } });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    // 50 + 120 en solo → 70 + 168 à deux.
    expect(totalWritten(written)).toBe(238);
    const rows = shares.flat() as Array<{ user_id: string; share_cp: number }>;
    expect(rows.reduce((s, r) => s + r.share_cp, 0)).toBe(238);
    expect(rows.map(r => r.user_id).sort()).toEqual([ALICE, BOB]);
  });

  it("keeps the shares summing to the awarded total for a trio", async () => {
    const { deps, written, shares } = makeDeps({ participants: trio(), challenge: { contribution_points_reward: 2000 } });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: CAROL });

    const rows = shares.flat() as Array<{ user_id: string; share_cp: number }>;
    expect(rows).toHaveLength(3);
    expect(rows.reduce((s, r) => s + r.share_cp, 0)).toBe(totalWritten(written));
  });

  it("costs the pool less than the same three contributors solo", async () => {
    const solo = makeDeps({ challenge: { contribution_points_reward: 2000 } });
    await new CodeRewardsService(solo.deps).evaluate({ challengeId: CH, userId: ALICE });
    const group = makeDeps({ participants: trio(), challenge: { contribution_points_reward: 2000 } });
    await new CodeRewardsService(group.deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(totalWritten(group.written)).toBeLessThan(totalWritten(solo.written) * 3);
  });

  it("only splits the delta when a member joins after a first run", async () => {
    // Le premier run a déjà versé 50 + 120 en solo ; à deux le brut monte à
    // 70 + 168, donc seul l'écart de 68 se répartit.
    const { deps, shares } = makeDeps({
      participants: pair(),
      existingEntries: [
        { rule_key: "code_fixed", points: 50 },
        { rule_key: "code_quality", points: 120 },
      ],
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    const rows = shares.flat() as Array<{ share_cp: number }>;
    expect(rows.reduce((s, r) => s + r.share_cp, 0)).toBe(68);
  });

  it("writes no share row for a solo contributor", async () => {
    // L'absence de rows est ce qui laisse le comportement historique intact.
    const { deps, shares } = makeDeps();
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    expect(shares).toHaveLength(0);
  });

  it("writes no share row for a group nobody has joined yet", async () => {
    const alone = [makeParticipation({ user_id: ALICE, group_id: GROUP })];
    const { deps, shares, written } = makeDeps({ participants: alone });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(shares).toHaveLength(0);
    expect(totalWritten(written)).toBe(170); // 50 + 120, comme un solo
  });

  it("writes no share row when the run pays nothing", async () => {
    const { deps, shares } = makeDeps({
      participants: pair(),
      existingEntries: [
        { rule_key: "code_fixed", points: 70 },
        { rule_key: "code_quality", points: 168 },
      ],
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    expect(shares).toHaveLength(0);
  });
});
