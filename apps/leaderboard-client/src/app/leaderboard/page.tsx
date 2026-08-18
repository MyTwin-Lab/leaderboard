import { LeaderboardLayout } from "@/components/leaderboard/LeaderboardLayout";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { fetchContributorSession } from "@/lib/contributor";

export const dynamic = 'force-dynamic';

type LeaderboardSearchParams = {
  projectId?: string;
  q?: string;
};

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<LeaderboardSearchParams> }) {
  const resolvedSearchParams = await searchParams;

  const initialProjectId = resolvedSearchParams.projectId ?? "all";
  const initialSearchTerm = resolvedSearchParams.q ?? "";

  const [initialData, session] = await Promise.all([
    fetchLeaderboard(initialProjectId),
    fetchContributorSession(),
  ]);

  return (
    <LeaderboardLayout
      initialEntries={initialData.entries}
      initialProjectId={initialProjectId}
      initialSearchTerm={initialSearchTerm}
      projects={initialData.filters.projects}
      currentUserId={session?.id}
    />
  );
}
