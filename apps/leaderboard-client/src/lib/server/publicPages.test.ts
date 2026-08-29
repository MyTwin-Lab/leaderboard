import { afterEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { fetchTrendingChallenges } from "./publicPages";

const NOW = new Date("2026-07-12T12:00:00Z");
const SIX_DAYS_AGO = new Date("2026-07-06T12:00:00Z");
const EIGHT_DAYS_AGO = new Date("2026-07-04T12:00:00Z");

describe("fetchTrendingChallenges", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("returns challenges sorted by recent contribution count, excluding drafts and stale challenges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "contrib-1", challenge_id: "c1", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T1", type: "code" },
      { uuid: "contrib-2", challenge_id: "c1", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T2", type: "code" },
      { uuid: "contrib-3", challenge_id: "c2", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T3", type: "code" },
      // old contribution — should not count
      { uuid: "contrib-4", challenge_id: "c2", user_id: "u1", submitted_at: EIGHT_DAYS_AGO, reward: 10, title: "T4", type: "code" },
    ] as any);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      {
        uuid: "c1", title: "Challenge Alpha", status: "active", type: "code",
        index: 1, contribution_points_reward: 500, completion: 0.4,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
      {
        uuid: "c2", title: "Challenge Beta", status: "active", type: "ml",
        index: 2, contribution_points_reward: 300, completion: 0.2,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
      // draft — should be excluded
      {
        uuid: "c3", title: "Challenge Draft", status: "draft", type: "code",
        index: 3, contribution_points_reward: 100, completion: 0,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
    ] as any);

    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project One", description: "Great project", created_at: new Date() },
    ] as any);

    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([
      { challenge_id: "c1", user_id: "u1" },
    ] as any);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", avatar_url: null },
    ] as any);

    const result = await fetchTrendingChallenges(3);

    // c1 has 2 recent contributions, c2 has 1, c3 excluded (draft)
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c1");
    expect(result[0].recentContributions).toBe(2);
    expect(result[0].completion).toBe(40); // 0.4 * 100
    expect(result[1].id).toBe("c2");
    expect(result[1].recentContributions).toBe(1);
    // Draft excluded
    expect(result.find(r => r.id === "c3")).toBeUndefined();
    // Team member mapped correctly
    expect(result[0].teamMembers).toEqual([{ id: "u1", fullName: "Alice", avatarUrl: undefined }]);
  });

  it("returns at most `limit` results", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "x1", challenge_id: "ca", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x2", challenge_id: "cb", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x3", challenge_id: "cc", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x4", challenge_id: "cd", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);

    const makeChallenge = (id: string) => ({
      uuid: id, title: `C ${id}`, status: "active", type: "code", index: 1,
      contribution_points_reward: 100, completion: 0, project_id: "p1",
      start_date: new Date(), end_date: new Date(),
    });

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue(
      ["ca", "cb", "cc", "cd"].map(makeChallenge) as any
    );
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);

    const result = await fetchTrendingChallenges(2);
    expect(result).toHaveLength(2);
  });

  it("falls back to the most recently created challenges when there is no recent activity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      // Only stale activity — nothing counts as trending.
      { uuid: "old", challenge_id: "c1", user_id: "u1", submitted_at: EIGHT_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", title: "C1", status: "active", type: "code", index: 1, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      { uuid: "c2", title: "C2", status: "active", type: "code", index: 3, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      // Higher index but a draft → must stay hidden even in the fallback.
      { uuid: "c3", title: "C3", status: "draft", type: "code", index: 4, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      { uuid: "c4", title: "C4", status: "active", type: "code", index: 2, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
    ] as any);
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);

    const result = await fetchTrendingChallenges(2);

    // Newest first by index (draft excluded): c2 (3), c4 (2).
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(["c2", "c4"]);
    expect(result[0].recentContributions).toBe(0);
    expect(result.find(r => r.id === "c3")).toBeUndefined();
  });
});
