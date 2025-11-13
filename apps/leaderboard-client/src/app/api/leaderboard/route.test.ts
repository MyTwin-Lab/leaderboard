import { afterEach, describe, expect, it, vi } from "vitest";

import { repositories } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/leaderboard", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns leaderboard entries and project filters", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project A", description: null, created_at: new Date() },
      { uuid: "p2", title: "Project B", description: null, created_at: new Date() },
    ] as any);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", project_id: "p1", contribution_points_reward: 100 } as any,
      { uuid: "c2", project_id: "p2", contribution_points_reward: 200 } as any,
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
      },
      {
        rank: 2,
        userId: "u1",
        displayName: "Alice",
        githubUsername: "alice",
        totalCP: 20,
      },
    ]);

    expect(json.filters.projects).toEqual([
      { id: null, name: "All projects" },
      { id: "p1", name: "Project A" },
      { id: "p2", name: "Project B" },
    ]);
  });

  it("validates projectId existence", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project A" } as any,
    ]);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([]);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([]);
    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([]);

    const request = new Request("https://example.test/api/leaderboard?projectId=not-found");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "Invalid projectId" });
  });

  it("filters by projectId", async () => {
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project A" } as any,
      { uuid: "p2", title: "Project B" } as any,
    ]);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", project_id: "p1" } as any,
      { uuid: "c2", project_id: "p2" } as any,
    ]);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", github_username: "alice" } as any,
      { uuid: "u2", full_name: "Bob", github_username: "bob" } as any,
    ]);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { user_id: "u1", challenge_id: "c1", reward: 20 } as any,
      { user_id: "u2", challenge_id: "c2", reward: 40 } as any,
    ]);

    const request = new Request("https://example.test/api/leaderboard?projectId=p1");
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
