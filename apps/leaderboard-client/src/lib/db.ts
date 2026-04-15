import "server-only";

import {
  ProjectRepository,
  ChallengeRepository,
  ContributionRepository,
  UserRepository,
  ChallengeTeamRepository,
  DiscordAccountRepository,
  DiscordEvaluationRepository,
} from "../../../../packages/database-service/repositories/index";

export const repositories = {
  project: new ProjectRepository(),
  challenge: new ChallengeRepository(),
  contribution: new ContributionRepository(),
  user: new UserRepository(),
  challengeTeam: new ChallengeTeamRepository(),
  discordAccount: new DiscordAccountRepository(),
  discordEvaluation: new DiscordEvaluationRepository(),
};

export type Repositories = typeof repositories;
