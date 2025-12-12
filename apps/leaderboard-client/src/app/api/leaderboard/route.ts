import { NextResponse } from "next/server";

import { fetchLeaderboard, ProjectNotFoundError } from "@/lib/server/leaderboard";
import { leaderboardQuerySchema, parseSearchParams } from "@/lib/validation";

import type { LeaderboardResponse } from "@/lib/types";

export async function GET(request: Request): Promise<NextResponse<LeaderboardResponse | { error: string }>> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const { projectId, timePeriod } = parseSearchParams(leaderboardQuerySchema, searchParams);

    const data = await fetchLeaderboard(projectId, timePeriod);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    console.error("[GET /api/leaderboard]", error);
    return NextResponse.json({ error: "Failed to compute leaderboard" }, { status: 500 });
  }
}
