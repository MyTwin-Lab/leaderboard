import { ConnectorRegistry } from '../../../../packages/connectors/registry';
import { EvaluationGridRegistry } from '../../../../packages/evaluator/grids';
import { BundleSourceRegistry, type BundleSource } from '../../../../packages/capabilities/evaluation';
import { ProvisionerRegistry } from '../../../../packages/provisioner/src/registry';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { DatabaseGridProvider } from '../../../../packages/services/database-grid-provider';
import { IntegrationRegistry, type IntegrationDefinition } from '../../../../packages/connectors/integrations';
import { githubConnector } from '../../../../content/connectors/github';
import { githubIntegration } from '../../../../content/connectors/github/integration';
import { kaggleIntegration } from '../../../../content/connectors/kaggle/integration';
import { slackIntegration } from '../../../../content/connectors/slack/integration';
import { openaiIntegration } from '../../../../content/integrations/openai/integration';
import { scalewayIntegration } from '../../../../content/extensions/compute/integration';
import { kaggleConnector } from '../../../../content/connectors/kaggle';
import { slackConnector } from '../../../../content/connectors/slack';
import { githubSnapshotSource } from '../../../../content/bundle-sources/github-snapshot';
import { kaggleArtifactSource } from '../../../../content/bundle-sources/kaggle-artifact';
import { GitHubBranchProvider } from '../../../../content/workspace-providers/github-branch';
import { platform } from './mytwin.platform';

/**
 * Distribution MyTwin — côté serveur
 * ----------------------------------
 * Le seul endroit qui dit ce qui est installé sur cette plateforme. Le core
 * ne connaît aucun flow, extension, connecteur ni provider : il lit ce que ce
 * manifeste enregistre. Un connecteur ou un flow client suivrait le même
 * chemin.
 *
 * Installée une fois au démarrage du serveur (`src/instrumentation.ts`).
 * Idempotente, pour les tests et les scripts qui l'installent eux-mêmes.
 */

export const connectors = [githubConnector, kaggleConnector, slackConnector];

/** Les connexions qu'un admin établit depuis ses réglages, dans l'ordre de leurs cartes. */
export const integrations: IntegrationDefinition[] = [
  githubIntegration,
  kaggleIntegration,
  slackIntegration,
  openaiIntegration,
  scalewayIntegration,
];

/** Ce que la capacité `evaluate` sait noter : un dépôt GitHub, un artefact soumis. */
export const bundleSources: BundleSource[] = [githubSnapshotSource, kaggleArtifactSource];

const INSTALLED_KEY = '__leaderboardServerDistributionInstalled';

export function installServerDistribution(): void {
  const holder = globalThis as unknown as Record<string, boolean | undefined>;
  if (holder[INSTALLED_KEY]) return;

  PlatformRegistry.install(platform);
  for (const connector of connectors) ConnectorRegistry.register(connector);
  for (const integration of integrations) IntegrationRegistry.register(integration);
  for (const source of bundleSources) BundleSourceRegistry.register(source);

  // Les grilles sont servies par la base : celles qu'éditent les admins, et
  // les seeds de la distribution (`mytwin.grids.ts`), insérées au déploiement.
  EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());

  // Branches perso des challenges code. Le token vient encore de
  // l'environnement ; il passera par la connexion GitHub, lu à chaque appel
  // (challenge 020, lot L5).
  if (process.env.GITHUB_TOKEN) {
    ProvisionerRegistry.register(new GitHubBranchProvider());
  } else {
    console.warn('[distribution] GITHUB_TOKEN not set, GitHub branch provider not available');
  }

  holder[INSTALLED_KEY] = true;
}
