import "server-only";

import {
  ProjectRepository,
  ChallengeRepository,
  ContributionRepository,
  UserRepository,
  ChallengeTeamRepository,
  OnboardingProgressRepository,
  ChallengeDocumentRepository,
} from "../../../../packages/database-service/repositories/index";

export const repositories = {
  project: new ProjectRepository(),
  challenge: new ChallengeRepository(),
  contribution: new ContributionRepository(),
  user: new UserRepository(),
  challengeTeam: new ChallengeTeamRepository(),
  onboardingProgress: new OnboardingProgressRepository(),
  challengeDocument: new ChallengeDocumentRepository(),
};

export type Repositories = typeof repositories;
