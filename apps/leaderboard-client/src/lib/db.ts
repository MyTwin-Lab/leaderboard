import "server-only";

import {
  ProjectRepository,
  ChallengeRepository,
  ContributionRepository,
  UserRepository,
  ChallengeTeamRepository,
  OnboardingProgressRepository,
} from "../../../../packages/database-service/repositories/index";

export const repositories = {
  project: new ProjectRepository(),
  challenge: new ChallengeRepository(),
  contribution: new ContributionRepository(),
  user: new UserRepository(),
  challengeTeam: new ChallengeTeamRepository(),
  onboardingProgress: new OnboardingProgressRepository(),
};

export type Repositories = typeof repositories;
