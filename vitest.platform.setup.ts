import { PlatformRegistry } from "./packages/registry/platform.js";
import { platform } from "./apps/leaderboard-client/src/distribution/mytwin.platform";

/**
 * Les tests serveur tournent avec la plateforme MyTwin installée, comme le
 * serveur après son démarrage : les clés du ledger, le pool et les types de
 * contribution y sont lus. Un test qui vérifie l'installation elle-même
 * réinitialise le registre ; le fichier suivant le retrouve installé.
 */
if (!PlatformRegistry.isInstalled()) {
  PlatformRegistry.install(platform);
}
