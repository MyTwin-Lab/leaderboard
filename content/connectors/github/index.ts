import type { ConnectorDefinition } from "../../../packages/connectors/registry.js";
import { getGithubToken } from "../../../packages/config/githubToken.js";
import { GitHubExternalConnector } from "./connector.js";
import { toPublicGithubActivity } from "./activity.js";

export { GitHubExternalConnector } from "./connector.js";

/**
 * Connecteur GitHub : commits, contenus et activité d'un dépôt `owner/repo`.
 *
 * Le token vient de la connexion GitHub des réglages admin, avec `GITHUB_TOKEN`
 * en repli (`getGithubToken`). Sans token, le connecteur n'est construit que si
 * l'appelant l'accepte (`allowAnonymous`) : les dépôts publics restent
 * lisibles, à ~60 requêtes par heure.
 */
export const githubConnector: ConnectorDefinition = {
  key: "github",
  repoTypes: ["github"],
  // Un visiteur anonyme ne voit ni les branches perso ni leurs noms.
  activity: { toPublic: toPublicGithubActivity },
  async create(repo, options) {
    if (!repo.external_repo_id) {
      console.error(`[github connector] Missing external_repo_id for GitHub repo: ${repo.title ?? "(untitled)"}`);
      return null;
    }

    const [owner, repoName] = repo.external_repo_id.split("/");
    if (!owner || !repoName) {
      console.error(
        `[github connector] Invalid external_repo_id for repo: ${repo.title ?? "(untitled)"}. Expected "owner/repo", got "${repo.external_repo_id}"`
      );
      return null;
    }

    const token = await getGithubToken();
    if (!token && !options?.allowAnonymous) {
      console.error("[github connector] No GitHub token available (DB or .env)");
      return null;
    }

    return new GitHubExternalConnector({
      token: token ?? undefined,
      owner,
      repo: repoName,
      branch: options?.branch,
    });
  },
};
