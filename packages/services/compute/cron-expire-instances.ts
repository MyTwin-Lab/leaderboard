import { ComputeRequestService } from './compute-request.service.js';
import { purgeScalewaySecretIfSafe } from '../../../content/extensions/compute/integration.js';

export async function expireComputeInstances(): Promise<void> {
  const service = new ComputeRequestService();
  await service.sweepExpired();
  // Only actually purges the Scaleway secret if a soft-disconnect was
  // requested AND no request anywhere is still active — safe to call on
  // every tick even when neither condition holds.
  await purgeScalewaySecretIfSafe();
}
