export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  githubUsername: string;
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
};

export type ContributorChallenge = {
  id: string;
  title: string;
  projectName: string;
  reward: number;
  contributionShare: number;
  contributions: ContributorContribution[];
};

export type ContributorProfile = {
  userId: string;
  displayName: string;
  githubUsername: string;
  totalCP: number;
  challenges: ContributorChallenge[];
};

export type ProjectFilter = LeaderboardResponse["filters"]["projects"][number];
