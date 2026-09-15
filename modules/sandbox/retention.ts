import { SandboxStarRepository } from "../../packages/database-service/repositories/index.js";
import { ipHashRetentionCutoff } from "../../packages/services/sandbox/starPolicy.js";

export interface IpHashPurgeDeps {
  starRepo: Pick<SandboxStarRepository, "purgeIpHashesOlderThan">;
  now: () => Date;
}

/**
 * Efface les hachés d'IP des étoiles au-delà de 30 jours. Même règle que la
 * purge opportuniste de `SandboxService.star` : sans vote, les hachés
 * dépasseraient sinon la durée annoncée.
 */
export async function purgeIpHashes(deps?: Partial<IpHashPurgeDeps>): Promise<{ purged: number }> {
  const starRepo = deps?.starRepo ?? new SandboxStarRepository();
  const now = deps?.now?.() ?? new Date();
  return { purged: await starRepo.purgeIpHashesOlderThan(ipHashRetentionCutoff(now)) };
}
