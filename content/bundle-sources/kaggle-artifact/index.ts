import { ConnectorRegistry } from "../../../packages/connectors/registry.js";
import type { ExternalConnector } from "../../../packages/connectors/interfaces.js";
import type { BundleSource } from "../../../packages/capabilities/evaluation.js";

export const KAGGLE_ARTIFACT_SOURCE = "kaggle-artifact";

export interface KaggleArtifactInput {
  /** `owner/slug`, tel que l'extrait `extractArtifactRef`. */
  ref: string;
  /**
   * Le type de connecteur qui lit l'artefact : `kaggle_dataset` ou
   * `kaggle_model`, et `github` pour le code d'un modèle ML, lu de la même
   * façon (son dernier commit).
   */
  repoType: string;
}

export interface KaggleArtifactDeps {
  createConnector(ref: string, repoType: string): Promise<ExternalConnector | null>;
}

/**
 * Source `kaggle-artifact`
 * ------------------------
 * La dernière version d'un artefact soumis : les fichiers de son élément le
 * plus récent (une version de dataset Kaggle, un commit). Pas d'agrégation :
 * c'est l'artefact tel que soumis qui est noté.
 */
export function createKaggleArtifactSource(deps?: Partial<KaggleArtifactDeps>): BundleSource<KaggleArtifactInput> {
  const createConnector =
    deps?.createConnector ??
    ((ref: string, repoType: string) =>
      ConnectorRegistry.createConnector({ title: ref, type: repoType, external_repo_id: ref }));

  return {
    key: KAGGLE_ARTIFACT_SOURCE,
    async collect({ ref, repoType }) {
      const connector = await createConnector(ref, repoType);
      if (!connector) throw new Error(`[kaggle-artifact] No connector for ${repoType}`);

      await connector.connect();
      try {
        const items = await connector.fetchItems();
        if (items.length === 0) throw new Error(`[kaggle-artifact] Nothing to evaluate at ${ref}`);

        const content = await connector.fetchItemContent(items[0].id);
        return {
          snapshot: { commitSha: content.commitSha, modifiedFiles: content.modifiedFiles ?? [] },
          refs: content.commitSha ? [content.commitSha] : [],
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

export const kaggleArtifactSource = createKaggleArtifactSource();
