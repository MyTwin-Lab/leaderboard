import { formatCP } from "@/lib/formatters";

interface ContributorStatsProps {
  totalCP: number;
  challengeCount: number;
}

export function ContributorStats({ totalCP, challengeCount }: ContributorStatsProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <StatCard label="Contribution Points" value={`${formatCP(totalCP)} CP`} />
      <StatCard label="Challenges" value={challengeCount.toString()} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-1 rounded-lg bg-white/5 p-4 text-white">
      <span className="text-xs uppercase tracking-wide text-white/50">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}
