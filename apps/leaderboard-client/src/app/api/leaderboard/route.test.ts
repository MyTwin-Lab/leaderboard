import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repositories } from "@/lib/db";
import { GET } from "./route";

// `leaderboardQuerySchema` valide `projectId` comme un UUID. Les identifiants
// « p1 » / « p2 » d'origine échouaient donc à la validation avant même
// d'atteindre la route, qui répondait 500 au lieu du 400 ou du 200 attendu.
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
/** Bien formé, mais absent de la liste des projets : c'est le cas 400. */
const MISSING = "33333333-3333-4333-8333-333333333333";

describe("GET /api/leaderboard", () => {
  // `fetchLeaderboard` a gagné deux lectures après l'écriture de ces tests :
  // les parts de groupe (`contributionMember`) et le ledger sandbox. Sans
  // doublure, l'appel atteint un vrai client Postgres et la route répond 500.
  //
  // Neutralisées ici plutôt que dans chaque cas : ça dit ce qu'on veut dire —
  // ni groupe ni sandbox ne participent à ces fixtures — et un troisième
  // ledger ajouté demain ne cassera pas les trois tests d'un coup.
  beforeEach(() => {
    vi.spyOn(repositories.contributionMember, "findAll").mockResolvedValue([]);
    vi.spyOn(repositories.sandboxReward, "findAll").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns leaderboard entries and project filters", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: P1, title: "Project A", description: null, created_at: new Date() },
      { uuid: P2, title: "Project B", description: null, created_at: new Date() },
    ] as any);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", project_id: P1, contribution_points_reward: 100 } as any,
      { uuid: "c2", project_id: P2, contribution_points_reward: 200 } as any,
    ]);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", github_username: "alice" } as any,
      { uuid: "u2", full_name: "Bob", github_username: "bob" } as any,
    ]);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { user_id: "u1", challenge_id: "c1", reward: 20 } as any,
      { user_id: "u2", challenge_id: "c2", reward: 40 } as any,
    ]);

    const request = new Request("https://example.test/api/leaderboard");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.entries).toEqual([
      {
        rank: 1,
        userId: "u2",
        displayName: "Bob",
        githubUsername: "bob",
        totalCP: 40,
        contributionsCount: 1,
      },
      {
        rank: 2,
        userId: "u1",
        displayName: "Alice",
        githubUsername: "alice",
        totalCP: 20,
        contributionsCount: 1,
      },
    ]);

    expect(json.filters.projects).toEqual([
      { id: null, name: "All Projects" },
      { id: P1, name: "Project A" },
      { id: P2, name: "Project B" },
    ]);
  });

  it("validates projectId existence", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: P1, title: "Project A" } as any,
    ]);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([]);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([]);
    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([]);

    const request = new Request(`https://example.test/api/leaderboard?projectId=${MISSING}`);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "Invalid projectId" });
  });

  it("filters by projectId", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: P1, title: "Project A" } as any,
      { uuid: P2, title: "Project B" } as any,
    ]);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", project_id: P1 } as any,
      { uuid: "c2", project_id: P2 } as any,
    ]);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", github_username: "alice" } as any,
      { uuid: "u2", full_name: "Bob", github_username: "bob" } as any,
    ]);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { user_id: "u1", challenge_id: "c1", reward: 20 } as any,
      { user_id: "u2", challenge_id: "c2", reward: 40 } as any,
    ]);

    const request = new Request(`https://example.test/api/leaderboard?projectId=${P1}`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.entries).toEqual([
      {
        rank: 1,
        userId: "u1",
        displayName: "Alice",
        githubUsername: "alice",
        totalCP: 20,
        contributionsCount: 1,
      },
    ]);
  });

  it("handles errors", async () => {
    vi.spyOn(repositories.project, "findAll").mockRejectedValue(new Error("boom"));

    const request = new Request("https://example.test/api/leaderboard");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toEqual({ error: "Failed to compute leaderboard" });
  });
});
