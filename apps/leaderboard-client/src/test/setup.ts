// Vitest global setup
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { platform } from '../distribution/mytwin.platform';

// Les tests de l'app tournent avec la plateforme MyTwin installée, comme le
// serveur après son démarrage (`instrumentation.ts`). Un test qui vérifie
// l'installation elle-même réinitialise le registre ; le fichier suivant le
// retrouve installé.
if (!PlatformRegistry.isInstalled()) {
  PlatformRegistry.install(platform);
}
