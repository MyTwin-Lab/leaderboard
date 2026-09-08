import { describe, expect, it } from "vitest";
import { buildDigestPayload, type DigestSource } from "./digest-payload.js";
import type {
  Challenge, Contribution, ContributionMember, RewardEntry, User,
} from "../../database-service/domain/entities.js";

const CH = "ch-1", ALICE = "alice", BOB = "bob", CAROL = "carol";

function user(uuid: string, full_name: string): User {
  return { uuid, full_name, role: "contributor", created_at: new Date("2026-09-01T00:00:00Z") };
}

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: CH, title: "Build the API", status: "active", type: "code",
    contribution_points_reward: 1000, completion: 0, project_id: "p-1",
    created_at: new Date("2026-09-01T00:00:00Z"),
    ...over,
  };
}

function contribution(over: Partial<Contribution> = {}): Contribution {
  return {
    uuid: "c-1", title: "Global delivery", type: "project",
    reward: 300, user_id: ALICE, challenge_id: CH,
    created_at: new Date("2026-09-02T00:00:00Z"),
    submitted_at: new Date("2026-09-02T00:00:00Z"),
    ...over,
  };
}

function entry(over: Partial<RewardEntry> = {}): RewardEntry {
  return {
    uuid: `r-${Math.random()}`, challenge_id: CH, user_id: ALICE,
    contribution_id: "c-1", rule_key: "code_quality", points: 120,
    created_at: new Date("2026-09-03T00:00:00Z"),
    ...over,
  };
}

function source(over: Partial<DigestSource> = {}): DigestSource {
  return {
    contributions: [],
    contributionMembers: [],
    challengesCreated: [],
    challengesClosed: [],
    contributors: [],
    rewardEntries: [],
    usersById: new Map([
      [ALICE, user(ALICE, "Alice Dupont")],
      [BOB, user(BOB, "Bob Martin")],
      [CAROL, user(CAROL, "Carol Diaz")],
    ]),
    challengesById: new Map([[CH, challenge()]]),
    projectTitlesById: new Map([["p-1", "MyTwin Core"]]),
    cpAwardedByChallenge: new Map(),
    ...over,
  };
}

describe("buildDigestPayload — new_contributions", () => {
  it("credits a solo contribution to its author", () => {
    const payload = buildDigestPayload(source({ contributions: [contribution()] }));
    expect(payload.new_contributions).toHaveLength(1);
    expect(payload.new_contributions[0].contributors).toEqual([
      { user_id: ALICE, full_name: "Alice Dupont" },
    ]);
    expect(payload.new_contributions[0].reward_cp).toBe(300);
    expect(payload.new_contributions[0].challenge_title).toBe("Build the API");
  });

  it("lists every member of a group contribution", () => {
    // contributions.user_id ne porte que le porteur : sans la jointure, un
    // travail à trois serait attribué à Alice seule.
    const members: ContributionMember[] = [
      { contribution_id: "c-1", user_id: ALICE, share_cp: 100 },
      { contribution_id: "c-1", user_id: BOB, share_cp: 100 },
      { contribution_id: "c-1", user_id: CAROL, share_cp: 100 },
    ];
    const payload = buildDigestPayload(source({
      contributions: [contribution()], contributionMembers: members,
    }));
    expect(payload.new_contributions[0].contributors.map((c) => c.user_id).sort())
      .toEqual([ALICE, BOB, CAROL]);
  });

  it("reports the group's global reward, not an individual share", () => {
    const members: ContributionMember[] = [
      { contribution_id: "c-1", user_id: ALICE, share_cp: 150 },
      { contribution_id: "c-1", user_id: BOB, share_cp: 150 },
    ];
    const payload = buildDigestPayload(source({
      contributions: [contribution({ reward: 300 })], contributionMembers: members,
    }));
    expect(payload.new_contributions[0].reward_cp).toBe(300);
  });

  it("keeps the holder first among the contributors", () => {
    const members: ContributionMember[] = [
      { contribution_id: "c-1", user_id: BOB, share_cp: 150 },
      { contribution_id: "c-1", user_id: ALICE, share_cp: 150 },
    ];
    const payload = buildDigestPayload(source({
      contributions: [contribution({ user_id: ALICE })], contributionMembers: members,
    }));
    expect(payload.new_contributions[0].contributors[0].user_id).toBe(ALICE);
  });

  it("does not duplicate the holder when they also have a member row", () => {
    const members: ContributionMember[] = [
      { contribution_id: "c-1", user_id: ALICE, share_cp: 150 },
      { contribution_id: "c-1", user_id: BOB, share_cp: 150 },
    ];
    const payload = buildDigestPayload(source({
      contributions: [contribution({ user_id: ALICE })], contributionMembers: members,
    }));
    expect(payload.new_contributions[0].contributors).toHaveLength(2);
  });

  it("ignores member rows belonging to another contribution", () => {
    const members: ContributionMember[] = [
      { contribution_id: "c-2", user_id: BOB, share_cp: 150 },
    ];
    const payload = buildDigestPayload(source({
      contributions: [contribution({ uuid: "c-1" })], contributionMembers: members,
    }));
    expect(payload.new_contributions[0].contributors.map((c) => c.user_id)).toEqual([ALICE]);
  });

  it("falls back to a placeholder name when a user is missing", () => {
    // Un compte supprimé entre la fenêtre et la génération ne doit pas faire
    // échouer un digest — il fige ce qu'il peut.
    const payload = buildDigestPayload(source({
      contributions: [contribution({ user_id: "ghost" })],
      usersById: new Map(),
    }));
    expect(payload.new_contributions[0].contributors[0].full_name).toBe("Unknown");
  });
});

describe("buildDigestPayload — challenges", () => {
  it("denormalizes the project title of a new challenge", () => {
    const payload = buildDigestPayload(source({ challengesCreated: [challenge()] }));
    expect(payload.new_challenges[0]).toMatchObject({
      challenge_id: CH, title: "Build the API", type: "code",
      project_title: "MyTwin Core", reward_pool: 1000,
    });
  });

  it("reports what a completed challenge actually paid out", () => {
    const closed = challenge({ status: "completed", closed_at: new Date("2026-09-04T10:00:00Z") });
    const payload = buildDigestPayload(source({
      challengesClosed: [closed],
      cpAwardedByChallenge: new Map([[CH, 840]]),
    }));
    expect(payload.completed_challenges[0]).toMatchObject({ reward_pool: 1000, cp_awarded: 840 });
    expect(payload.completed_challenges[0].closed_at).toBe("2026-09-04T10:00:00.000Z");
  });

  it("reports zero paid out when a challenge closed empty", () => {
    const closed = challenge({ status: "completed", closed_at: new Date("2026-09-04T10:00:00Z") });
    const payload = buildDigestPayload(source({ challengesClosed: [closed] }));
    expect(payload.completed_challenges[0].cp_awarded).toBe(0);
  });
});

describe("buildDigestPayload — cp_distributed", () => {
  it("aggregates the ledger by user and challenge", () => {
    const payload = buildDigestPayload(source({
      rewardEntries: [
        entry({ rule_key: "code_fixed", points: 50 }),
        entry({ rule_key: "code_quality", points: 120 }),
        entry({ rule_key: "code_quality", points: 80 }),
      ],
    }));
    expect(payload.cp_distributed).toHaveLength(1);
    expect(payload.cp_distributed[0]).toMatchObject({
      user_id: ALICE, challenge_id: CH, total_cp: 250,
      by_rule: { code_fixed: 50, code_quality: 200 },
    });
  });

  it("keeps one row per user on the same challenge", () => {
    const payload = buildDigestPayload(source({
      rewardEntries: [entry({ user_id: ALICE }), entry({ user_id: BOB, points: 60 })],
    }));
    expect(payload.cp_distributed).toHaveLength(2);
  });

  it("keeps one row per challenge for the same user", () => {
    const payload = buildDigestPayload(source({
      rewardEntries: [entry({ challenge_id: CH }), entry({ challenge_id: "ch-2" })],
    }));
    expect(payload.cp_distributed).toHaveLength(2);
  });

  it("nets out a deduction against an award", () => {
    // Les prélèvements de réutilisation sont des points négatifs sur la même
    // clé : le total doit refléter ce qui est réellement resté au contributeur.
    const payload = buildDigestPayload(source({
      rewardEntries: [
        entry({ rule_key: "model_metric", points: 200 }),
        entry({ rule_key: "reuse_dataset", points: -40 }),
      ],
    }));
    expect(payload.cp_distributed[0].total_cp).toBe(160);
    expect(payload.cp_distributed[0].by_rule.reuse_dataset).toBe(-40);
  });

  it("sorts by descending total so the period reads top-down", () => {
    const payload = buildDigestPayload(source({
      rewardEntries: [
        entry({ user_id: ALICE, points: 30 }),
        entry({ user_id: BOB, points: 300 }),
      ],
    }));
    expect(payload.cp_distributed.map((r) => r.user_id)).toEqual([BOB, ALICE]);
  });

  it("catches a re-evaluation of a contribution created in an earlier period", () => {
    // C'est la raison d'être de la section : la contribution n'est pas dans
    // new_contributions (créée avant la fenêtre) mais ses CP le sont.
    const payload = buildDigestPayload(source({
      contributions: [],
      rewardEntries: [entry({ rule_key: "code_quality", points: 200 })],
    }));
    expect(payload.new_contributions).toHaveLength(0);
    expect(payload.cp_distributed[0].total_cp).toBe(200);
  });
});

describe("buildDigestPayload — new_contributors and shape", () => {
  it("lists new contributors with their join date", () => {
    const payload = buildDigestPayload(source({ contributors: [user(BOB, "Bob Martin")] }));
    expect(payload.new_contributors[0]).toMatchObject({
      user_id: BOB, full_name: "Bob Martin", role: "contributor",
    });
    expect(payload.new_contributors[0].joined_at).toBe("2026-09-01T00:00:00.000Z");
  });

  it("always returns all five sections, empty rather than absent", () => {
    // Un digest manuel sur une période courte est valide et majoritairement
    // vide : le lecteur doit trouver les cinq clés, pas des undefined.
    const payload = buildDigestPayload(source());
    expect(payload.version).toBe(1);
    expect(payload).toMatchObject({
      new_contributions: [], new_challenges: [], completed_challenges: [],
      new_contributors: [], cp_distributed: [],
    });
  });
});
