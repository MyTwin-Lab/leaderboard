export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  githubUsername?: string;
  bio?: string;
  avatarUrl?: string;
  totalCP: number;
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

export type ContributorProfile = {
  userId: string;
  displayName: string;
  githubUsername?: string;
  avatarUrl?: string;
  totalCP: number;
  challenges: ContributorChallenge[];
  globalRank?: number;
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
