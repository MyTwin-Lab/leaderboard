import type { ConnectorDefinition } from "../../../packages/connectors/registry.js";
import { getKaggleCredentials } from "../../../packages/config/kaggleCredentials.js";
import { KaggleConnector } from "./connector.js";

export { KaggleConnector, parseMetrics } from "./connector.js";

/**
 * Connecteur Kaggle : un dataset ou un modèle, désigné par `owner/slug`.
 *
 * Les credentials viennent de la connexion Kaggle des réglages admin, avec
 * `KAGGLE_USERNAME` / `KAGGLE_KEY` en repli.
 */
export const kaggleConnector: ConnectorDefinition = {
  key: "kaggle",
  repoTypes: ["kaggle_dataset", "kaggle_model"],
  async create(repo) {
    if (!repo.external_repo_id) {
      console.error(`[kaggle connector] Missing external_repo_id for Kaggle repo: ${repo.title ?? "(untitled)"}`);
      return null;
    }

    const credentials = await getKaggleCredentials();
    if (!credentials) {
      console.error("[kaggle connector] No Kaggle credentials available (DB or .env)");
      return null;
    }

    return new KaggleConnector({
      username: credentials.username,
      apiKey: credentials.apiKey,
      ref: repo.external_repo_id,
      subtype: repo.type as "kaggle_dataset" | "kaggle_model",
    });
  },
};
