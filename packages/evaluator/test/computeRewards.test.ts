import { describe, it, expect, vi, afterEach } from "vitest";
import { computeRewards } from "../reward.js";

describe("computeRewards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array and warns when no contributions", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = computeRewards([], 100);

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith("[computeRewards] Aucune contribution fournie");
  });

  it("returns empty array and warns when reward pool is invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = computeRewards(
      [
        {
          uuid: "c-1",
          user_id: "u-1",
          title: "Contribution 1",
          evaluation: { globalScore: 10 },
        },
      ],
      0
    );

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith("[computeRewards] Pool de rewards invalide:", 0);
  });

  it("distributes rewards proportionally to global scores", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const contributions = [
      {
        uuid: "c-1",
        user_id: "u-1",
        title: "Contribution 1",
        evaluation: { globalScore: 20 },
      },
      {
        uuid: "c-2",
        user_id: "u-2",
        title: "Contribution 2",
        evaluation: { globalScore: 30 },
      },
    ];

    const result = computeRewards(contributions, 100);

    expect(result).toEqual([
      {
        contributionId: "c-1",
        userId: "u-1",
        contributionTitle: "Contribution 1",
        score: 20,
        reward: 40,
      },
      {
        contributionId: "c-2",
        userId: "u-2",
        contributionTitle: "Contribution 2",
        score: 30,
        reward: 60,
      },
    ]);

    expect(logSpy).toHaveBeenCalledWith("[computeRewards] Distribué 100 CP sur 2 contributions");
  });

  it("distributes rewards equally when total score is zero", () => {
    const contributions = [
      {
        uuid: "c-1",
        user_id: "u-1",
        title: "Contribution 1",
        evaluation: { globalScore: 0 },
      },
      {
        uuid: "c-2",
        user_id: "u-2",
        title: "Contribution 2",
        evaluation: { globalScore: 0 },
      },
    ];

    const result = computeRewards(contributions, 90);

    expect(result).toEqual([
      {
        contributionId: "c-1",
        userId: "u-1",
        contributionTitle: "Contribution 1",
        score: 0,
        reward: 45,
      },
      {
        contributionId: "c-2",
        userId: "u-2",
        contributionTitle: "Contribution 2",
        score: 0,
        reward: 45,
      },
    ]);
  });
});
