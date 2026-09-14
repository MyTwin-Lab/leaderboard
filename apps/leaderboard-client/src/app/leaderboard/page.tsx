import { LeaderboardLayout } from "@/components/leaderboard/LeaderboardLayout";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { fetchContributorSession } from "@/lib/contributor";
import { pageMetadata } from "@/lib/seo";

export const dynamic = 'force-dynamic';

// Canonique sans query string : chaque filtre (?projectId, ?q) est une vue de
// la même page, pas une page à indexer à part.
export const metadata = pageMetadata({
  title: "Leaderboard",
  description:
    "The MyTwin Lab contributor ranking: who is building the digital twin of the human body, ranked by contribution points (CP) earned.",
  path: "/leaderboard",
});

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
