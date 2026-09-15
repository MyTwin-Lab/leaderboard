import { ConnectorRegistry } from '../../../../packages/connectors/registry';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { githubConnector } from '../../../../content/connectors/github';
import { kaggleConnector } from '../../../../content/connectors/kaggle';
import { slackConnector } from '../../../../content/connectors/slack';
import { platform } from './mytwin.platform';

/**
 * Distribution MyTwin — côté serveur
 * ----------------------------------
 * Le seul endroit qui dit ce qui est installé sur cette plateforme. Le core
 * ne connaît aucun flow, extension ni connecteur : il lit ce que ce manifeste
 * enregistre. Un connecteur ou un flow client suivrait le même chemin.
 *
 * Installée une fois au démarrage du serveur (`src/instrumentation.ts`).
 * Idempotente, pour les tests et les scripts qui l'installent eux-mêmes.
 */

export const connectors = [githubConnector, kaggleConnector, slackConnector];

const INSTALLED_KEY = '__leaderboardServerDistributionInstalled';

export function installServerDistribution(): void {
  const holder = globalThis as unknown as Record<string, boolean | undefined>;
  if (holder[INSTALLED_KEY]) return;

  PlatformRegistry.install(platform);
  for (const connector of connectors) ConnectorRegistry.register(connector);

  holder[INSTALLED_KEY] = true;
}
