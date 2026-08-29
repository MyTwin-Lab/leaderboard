import { afterEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { fetchHomeOverview } from "./home";

const NOW = new Date("2026-07-12T12:00:00Z");
const TWO_DAYS_AGO = new Date("2026-07-10T12:00:00Z");
const SIX_DAYS_AGO = new Date("2026-07-06T12:00:00Z");
const EIGHT_DAYS_AGO = new Date("2026-07-04T12:00:00Z");

describe("fetchHomeOverview", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("aggregates leaderboard, stats and trending challenges from a single data pass", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project One", description: null, created_at: new Date() },
    ] as any);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      {
        uuid: "c1", title: "Challenge Alpha", status: "active", type: "code",
        index: 1, contribution_points_reward: 500, completion: 0.4, project_id: "p1",
        start_date: new Date(), end_date: new Date(),
      },
      {
        uuid: "c2", title: "Challenge Beta", status: "active", type: "ml",
        index: 2, contribution_points_reward: 300, completion: 0.2, project_id: "p1",
        start_date: new Date(), end_date: new Date(),
      },
      {
        uuid: "c3", title: "Challenge Draft", status: "draft", type: "code",
        index: 3, contribution_points_reward: 100, completion: 0, project_id: "p1",
        start_date: new Date(), end_date: new Date(),
      },
    ] as any);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", bio: "Engineer", avatar_url: null, github_username: "alice" },
      { uuid: "u2", full_name: "Bob", bio: null, avatar_url: null, github_username: "bob" },
      { uuid: "u3", full_name: "Carol", bio: null, avatar_url: null, github_username: "carol" },
      { uuid: "u4", full_name: "Dave", bio: null, avatar_url: null, github_username: "dave" },
    ] as any);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "ct1", challenge_id: "c1", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 100, title: "T1", type: "code" },
      { uuid: "ct2", challenge_id: "c1", user_id: "u1", submitted_at: TWO_DAYS_AGO, reward: 50, title: "T2", type: "code" },
      { uuid: "ct3", challenge_id: "c1", user_id: "u2", submitted_at: TWO_DAYS_AGO, reward: 30, title: "T3", type: "code" },
      { uuid: "ct4", challenge_id: "c2", user_id: "u3", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T4", type: "code" },
      // Old, outside the 7-day window — still counts toward totals, not toward "recent"/spark.
      { uuid: "ct5", challenge_id: "c2", user_id: "u4", submitted_at: EIGHT_DAYS_AGO, reward: 5, title: "T5", type: "code" },
    ] as any);

    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([
      { challenge_id: "c1", user_id: "u1" },
      { challenge_id: "c1", user_id: "u2" },
    ] as any);

    const overview = await fetchHomeOverview();

    // Podium: ranked by totalCP desc — u1 (150), u2 (30), u3 (10).
    expect(overview.podium.map((p) => p.userId)).toEqual(["u1", "u2", "u3"]);
    expect(overview.podium[0].cp).toBe(150);
    expect(overview.podium[0].share).toBe(1);
    expect(overview.podium[0].contributionsCount).toBe(2);
    expect(overview.podium[1].share).toBeCloseTo(30 / 150);

    // u4 (5 CP) is the only "rest" entry.
    expect(overview.rest.map((r) => r.userId)).toEqual(["u4"]);

    // 4 users total, all 4 have CP > 0.
    expect(overview.contributorsRanked).toBe(4);

    // Stats: CP distributed total + this-week delta.
    const cpStat = overview.stats.find((s) => s.label === "CP distributed");
    expect(cpStat?.value).toBe((100 + 50 + 30 + 10 + 5).toLocaleString("fr-FR"));
    expect(cpStat?.delta).toContain("/ 7d");

    const challengesStat = overview.stats.find((s) => s.label === "Challenges open");
    expect(challengesStat?.value).toBe("2"); // c1 + c2 active, c3 draft excluded
    expect(challengesStat?.delta).toBe("1 project"); // both active challenges share p1

    // Global spark: 7 daily buckets, oldest → newest.
    expect(overview.spark).toHaveLength(7);
    expect(overview.spark.reduce((a, b) => a + b, 0)).toBe(4); // ct1..ct4 fall in the last 7 days, ct5 doesn't

    // Trending: only c1 and c2 have recent activity, c3 (draft) is excluded entirely.
    expect(overview.trendingChallenges.map((c) => c.id)).toEqual(["c1", "c2"]);
    const trendingC1 = overview.trendingChallenges[0];
    expect(trendingC1.recentContributions).toBe(3); // ct1, ct2, ct3 (SIX_DAYS_AGO is within the 7-day window)
    expect(trendingC1.activeContributors).toBe(2); // u1, u2
    expect(trendingC1.teamMembers).toHaveLength(2);
    expect(trendingC1.completion).toBe(40);
    expect(trendingC1.typeLabel).toBe("Code");
    expect(trendingC1.spark).toHaveLength(7);
  });

  it("falls back to the most recently created challenges when nothing is trending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", title: "C1", status: "active", type: "code", index: 1, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      { uuid: "c2", title: "C2", status: "active", type: "code", index: 3, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      { uuid: "c3", title: "C3", status: "draft", type: "code", index: 4, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
    ] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "old", challenge_id: "c1", user_id: "u1", submitted_at: EIGHT_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);

    const overview = await fetchHomeOverview();

    // Newest first by index, draft excluded.
    expect(overview.trendingChallenges.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(overview.trendingChallenges[0].recentContributions).toBe(0);
  });

  it("keeps archived challenges out of trending even when they saw recent activity", async () => {
    // Recent activity on an archived challenge is exactly when it would surface,
    // and it is the one time it must not: the fallback path already states that
    // drafts and archived stay hidden, so both paths have to agree.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", title: "Live", status: "active", type: "code", index: 1, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
      { uuid: "c2", title: "Retired", status: "archived", type: "code", index: 2, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
    ] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      // The archived one is busier, so ranking alone would put it first.
      { uuid: "a1", challenge_id: "c2", user_id: "u1", submitted_at: TWO_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "a2", challenge_id: "c2", user_id: "u2", submitted_at: TWO_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "a3", challenge_id: "c1", user_id: "u1", submitted_at: TWO_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);

    const overview = await fetchHomeOverview();

    expect(overview.trendingChallenges.map((c) => c.id)).toEqual(["c1"]);
  });
});
