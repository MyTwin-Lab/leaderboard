import { ConnectorRegistry } from "../../../packages/connectors/registry.js";
import type { ExternalConnector } from "../../../packages/connectors/interfaces.js";
import { aggregateItems } from "../../../packages/capabilities/bundle.js";
import type { BundleSource } from "../../../packages/capabilities/evaluation.js";

export const GITHUB_SNAPSHOT_SOURCE = "github-snapshot";

export interface GithubSnapshotInput {
  /** `owner/repo`. */
  slug: string;
  branch?: string;
  /** Plafond de commits agrégés. */
  maxCommits?: number;
}

export interface GithubSnapshotDeps {
  createConnector(slug: string, branch?: string): Promise<ExternalConnector | null>;
  aggregate: typeof aggregateItems;
}

/**
 * Source `github-snapshot`
 * ------------------------
 * L'état d'un dépôt GitHub (ou d'une branche) : les fichiers touchés par ses
 * derniers commits, la version la plus récente de chacun l'emportant.
 *
 * La connexion reste ouverte le temps de l'évaluation et se referme au
 * `release` ; une collecte qui échoue la referme aussitôt.
 */
export function createGithubSnapshotSource(deps?: Partial<GithubSnapshotDeps>): BundleSource<GithubSnapshotInput> {
  const createConnector =
    deps?.createConnector ??
    ((slug: string, branch?: string) =>
      ConnectorRegistry.createConnector(
        { title: slug, type: "github", external_repo_id: slug },
        branch ? { branch } : undefined,
      ));
  const aggregate = deps?.aggregate ?? aggregateItems;

  return {
    key: GITHUB_SNAPSHOT_SOURCE,
    async collect({ slug, branch, maxCommits = 100 }) {
      const connector = await createConnector(slug, branch);
      if (!connector) throw new Error(`[github-snapshot] No GitHub connector for ${slug}`);

      await connector.connect();
      try {
        const items = await connector.fetchItems();
        const shas = items.slice(0, maxCommits).map((item) => item.id);
        if (shas.length === 0) {
          throw new Error(`[github-snapshot] No commits found on ${slug}${branch ? `@${branch}` : ""}`);
        }

        const snapshot = await aggregate(() => connector, shas);
        if (!snapshot) throw new Error(`[github-snapshot] Unable to build snapshot for ${slug}`);

        return {
          snapshot,
          refs: shas,
          release: async () => {
            await connector.disconnect?.();
          },
        };
      } catch (error) {
        await connector.disconnect?.();
        throw error;
      }
    },
  };
}

export const githubSnapshotSource = createGithubSnapshotSource();
