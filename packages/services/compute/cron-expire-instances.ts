import { ComputeRequestService } from './compute-request.service.js';
import { AppSettingsRepository } from '../../database-service/repositories/index.js';

export async function expireComputeInstances(): Promise<void> {
  const service = new ComputeRequestService();
  await service.sweepExpired();
  // Only actually purges the Scaleway secret if a soft-disconnect was
  // requested AND no request anywhere is still active — safe to call on
  // every tick even when neither condition holds.
  await new AppSettingsRepository().purgeScalewaySecretIfSafe();
}
