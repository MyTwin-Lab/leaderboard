import { ComputeRequestService } from './compute-request.service.js';

export async function checkComputeProvisioning(): Promise<void> {
  await new ComputeRequestService().pollProvisioning();
}
