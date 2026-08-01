import { ProvisionerRegistry } from '../../provisioner/src/index.js';
import { ScalewayGpuProvider } from '../../provisioner/src/providers/scaleway-gpu.provider.js';
import { getScalewayCredentials } from '../../config/scalewayCredentials.js';

/**
 * Contrairement à GitHubBranchProvider (enregistré une fois au boot depuis
 * process.env), les credentials Scaleway sont en DB et mutables à chaud —
 * on reconstruit et ré-enregistre le provider avant chaque usage plutôt que
 * de dépendre d'un état "initialized" figé au démarrage du process (fragile
 * en environnement serverless avec cold starts).
 */
export async function getScalewayProvider(): Promise<ScalewayGpuProvider | null> {
  const creds = await getScalewayCredentials();
  if (!creds) return null;
  const provider = new ScalewayGpuProvider(creds);
  ProvisionerRegistry.register(provider);
  return provider;
}
