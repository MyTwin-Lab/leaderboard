import { getScalewayCredentials } from "../../../../packages/config/scalewayCredentials.js";
import { ScalewayGpuProvider } from "./gpu.provider.js";

/**
 * Le provider GPU, construit à la demande avec les credentials du store : un
 * admin peut reconnecter ou déconnecter Scaleway à tout moment. Il n'est pas
 * enregistré dans le provisioner — seul le service compute s'en sert.
 *
 * `null` sans connexion. Ignore volontairement la déconnexion différée : une
 * instance approuvée avant elle doit encore pouvoir être suivie et coupée.
 */
export async function scalewayProvider(): Promise<ScalewayGpuProvider | null> {
  const credentials = await getScalewayCredentials();
  return credentials ? new ScalewayGpuProvider(credentials) : null;
}
