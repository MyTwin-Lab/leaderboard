"use client";

import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaderboardCTA } from "@/components/leaderboard/LeaderboardCTA";

/** Groups the "Other contributors" list with the bottom CTA banner — both
 * hide together when the podium already covers every scored contributor
 * (see LeaderboardProvider.showList). */
export function LeaderboardListSection() {
  const { showList } = useLeaderboardContext();

  if (!showList) return null;

  return (
    <>
      <LeaderboardTable />
      <LeaderboardCTA />
    </>
  );
}
