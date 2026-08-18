import type { ContributorProfile } from "@/lib/types";

export interface ContributorKpis {
  totalContributions: number;
  totalChallenges: number;
  /** Contributions submitted in the last 30 days — shown as a caption under
   * the "Contributions" KPI, not as its own tile. */
  last30Days: number;
}

/** Pure aggregation over an already-fetched profile — safe to call from a
 * server page (to build header/KPI props) without pulling in "server-only"
 * data-access code. */
export function computeContributorKpis(challenges: ContributorProfile["challenges"]): ContributorKpis {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let totalContributions = 0;
  let last30Days = 0;

  for (const challenge of challenges) {
    totalContributions += challenge.contributions.length;
    for (const contribution of challenge.contributions) {
      if (!contribution.submittedAt) continue;
      const submitted = new Date(contribution.submittedAt).getTime();
      if (!Number.isNaN(submitted) && now - submitted <= thirtyDaysMs) {
        last30Days += 1;
      }
    }
  }

  return {
    totalContributions,
    totalChallenges: challenges.length,
    last30Days,
  };
}
