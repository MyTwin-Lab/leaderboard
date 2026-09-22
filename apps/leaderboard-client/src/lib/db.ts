import "server-only";

import {
  ProjectRepository,
  ChallengeRepository,
  ContributionRepository,
  ContributionMemberRepository,
  UserRepository,
  ChallengeTeamRepository,
  OnboardingProgressRepository,
  ChallengeDocumentRepository,
  ChallengeSignalRepository,
  RewardEntryRepository,
  SandboxRepository,
  SandboxStarRepository,
  SandboxRewardRepository,
  ImageRepository,
} from "../../../../packages/database-service/repositories/index";

export const repositories = {
  project: new ProjectRepository(),
  challenge: new ChallengeRepository(),
  contribution: new ContributionRepository(),
  contributionMember: new ContributionMemberRepository(),
  user: new UserRepository(),
  challengeTeam: new ChallengeTeamRepository(),
  onboardingProgress: new OnboardingProgressRepository(),
  challengeDocument: new ChallengeDocumentRepository(),
  challengeSignal: new ChallengeSignalRepository(),
  rewardEntry: new RewardEntryRepository(),
  sandbox: new SandboxRepository(),
  sandboxStar: new SandboxStarRepository(),
  sandboxReward: new SandboxRewardRepository(),
  image: new ImageRepository(),
};

export type Repositories = typeof repositories;
