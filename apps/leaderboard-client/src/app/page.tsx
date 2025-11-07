import { LeaderboardLayout } from "@/components/leaderboard/LeaderboardLayout";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { StatusBanner } from "@/components/ui/StatusBanner";

type LeaderboardSearchParams = {
  projectId?: string;
  q?: string;
};

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<LeaderboardSearchParams> }) {
  const resolvedSearchParams = await searchParams;

  const initialProjectId = resolvedSearchParams.projectId ?? "all";
  const initialSearchTerm = resolvedSearchParams.q ?? "";

  const initialData = await fetchLeaderboard(initialProjectId);

  return (
    <div className="space-y-6">
      <LeaderboardLayout
        initialEntries={initialData.entries}
        initialProjectId={initialProjectId}
        initialSearchTerm={initialSearchTerm}
        projects={initialData.filters.projects}
      />
      <StatusBanner message="Données mises à jour automatiquement après chaque sync" variant="info" />
    </div>
  );
}
