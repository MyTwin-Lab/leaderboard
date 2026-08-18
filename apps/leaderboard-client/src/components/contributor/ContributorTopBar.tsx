import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ContributorTopBarProps {
  actions?: React.ReactNode;
}

/** Breadcrumb back to the leaderboard, plus an optional actions slot
 * (admin / logout) — sits above the profile card on both the public and
 * self contributor pages. */
export function ContributorTopBar({ actions }: ContributorTopBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition-colors hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Leaderboard
      </Link>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
