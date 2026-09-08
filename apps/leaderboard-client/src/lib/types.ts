export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  githubUsername?: string;
  bio?: string;
  avatarUrl?: string;
  totalCP: number;
  contributionsCount: number;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  filters: {
    projects: Array<{ id: string | null; name: string }>;
  };
};

export type ContributorContribution = {
  id: string;
  title: string;
  description: string | null;
  reward: number;
  submittedAt: string | null;
  hasEvaluation: boolean;
  /**
   * Les autres membres du groupe qui a produit cette contribution — vide pour
   * une contribution solo. `reward` porte alors la part de ce contributeur,
   * pas le total du groupe.
   */
  coMembers?: TeamMember[];
};

export type ContributorDiscussionSignal = {
  signalId: string;
  label: string;
  /** Clé d'icône lucide (voir components/ui/signalIcons) */
  icon: string | null;
  count: number;
  totalCp: number;
};

export type ContributorDiscussion = {
  contributionId: string;
  totalCp: number;
  signals: ContributorDiscussionSignal[];
};

export type ContributorChallenge = {
  id: string;
  title: string;
  projectName: string;
  reward: number;
  contributionShare: number;
  contributions: ContributorContribution[];
  /** Signaux Slack agrégés — affichés en chips, pas dans la liste. */
  discussion?: ContributorDiscussion;
};

export type ContributorRankGap = {
  /** "ahead" when this contributor leads that rank, "behind" when trailing it. */
  direction: "ahead" | "behind";
  /** The adjacent rank being compared against (e.g. 2 for "#2"). */
  rank: number;
  /** CP difference, always positive. */
  cp: number;
};

export type ContributorProfile = {
  userId: string;
  displayName: string;
  githubUsername?: string;
  /** Free-text bio — same field the leaderboard/podium already show under a name. */
  bio?: string;
  avatarUrl?: string;
  totalCP: number;
  challenges: ContributorChallenge[];
  globalRank?: number;
  /** CP gap to the nearest adjacent rank on the global leaderboard. */
  rankGap?: ContributorRankGap;
  /** Earliest contribution's submission date (ISO string). */
  contributingSince?: string;
  /**
   * Average AI evaluation score (0–100) across evaluated contributions.
   * Only populated when the requesting viewer is the profile owner — like
   * `hasEvaluation` on individual contributions, evaluation detail is
   * private to its author.
   */
  avgEvaluationScore?: number;
  evaluatedContributionsCount?: number;
};

export type ProjectFilter = LeaderboardResponse["filters"]["projects"][number];

export type SessionUser = {
  id: string;
  fullName: string;
  githubUsername: string;
  email: string;
  role: string;
  avatarUrl?: string;
};

export type ContributorSession = SessionUser;

export type TeamMember = {
  id: string;
  fullName: string;
  avatarUrl?: string;
};

export type ProjectChallengeSummary = {
  id: string;
  index: number;
  title: string;
  description: string | null;
  status: string;
  type: string;
  rewardPool: number;
  contributionsCount: number;
  completion: number;
  teamMembers: TeamMember[];
  startDate: string | null;
  endDate: string | null;
  /** Contributions in the last 7 days — powers the card's activity spark. */
  recentContributions: number;
  /** Distinct contributors behind those last-7-days contributions. */
  activeContributors: number;
  /** 7 daily contribution counts for this challenge, oldest → newest. */
  spark: number[];
};

export type ProjectWithChallenges = {
  id: string;
  title: string;
  description: string | null;
  challenges: ProjectChallengeSummary[];
};

export type TrendingChallenge = {
  id: string;
  index: number;
  title: string;
  type: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0–100 (already multiplied)
  teamMembers: TeamMember[];
  startDate: string | null; // ISO string
  endDate: string | null;   // ISO string
  recentContributions: number;
};

// ── Home overview ────────────────────────────────────────────────────────
// Everything the home page needs, aggregated by fetchHomeOverview() in a
// single pass over the data — see src/lib/server/home.ts.

export type HomeStat = {
  value: string;
  label: string;
  delta: string;
};

export type HomeLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  cp: number;
};

export type HomePodiumEntry = HomeLeaderboardEntry & {
  /** 0–1, this entry's CP relative to the #1 contributor. */
  share: number;
  contributionsCount: number;
};

export type HomeTrendingChallenge = {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0–100
  teamMembers: TeamMember[];
  recentContributions: number;
  activeContributors: number;
  /** 7 daily contribution counts for this challenge, oldest → newest. */
  spark: number[];
};

export type HomeOverview = {
  stats: HomeStat[];
  /** 7 daily contribution counts (all challenges), oldest → newest. */
  spark: number[];
  podium: HomePodiumEntry[];
  rest: HomeLeaderboardEntry[];
  contributorsRanked: number;
  trendingChallenges: HomeTrendingChallenge[];
};
