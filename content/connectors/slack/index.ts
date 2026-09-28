import type { ConnectorDefinition } from "../../../packages/connectors/registry.js";
import { getSlackToken } from "../../../packages/config/slackCredentials.js";
import { SlackConnector } from "./connector.js";

export { SlackConnector, type SlackChannel } from "./connector.js";

/**
 * Connecteur Slack : l'historique d'un canal (`external_repo_id` = id du
 * canal) et la liste des canaux accessibles au bot quand aucun canal n'est
 * désigné.
 *
 * Le token vient de la connexion Slack des réglages admin, avec
 * `SLACK_BOT_TOKEN` en repli pour le développement.
 */
export const slackConnector: ConnectorDefinition = {
  key: "slack",
  repoTypes: ["slack"],
  async create(repo) {
    const token = await getSlackToken();
    if (!token) {
      console.error("[slack connector] No Slack token available (DB or .env)");
      return null;
    }

    return new SlackConnector({ token, channelId: repo.external_repo_id });
  },
};
