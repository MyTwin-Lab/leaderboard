export type ScalewayServerState = 'running' | 'stopped' | 'starting' | 'stopping' | 'locked' | 'error';

export interface CreateInstanceParams {
  zone: string;
  projectId: string;
  name: string;
  // TODO: confirm the exact GPU commercial_type/image once a real Scaleway
  // account is available for testing — see SPEC §9 (target: 16GB VRAM,
  // no exact current-catalog match; L4 (24GB) is the closest tier above).
  commercialType: string;
  imageId: string;
  /** Injected into the instance's cloud-init so Jupyter boots with this token pre-set. */
  cloudInitAccessToken: string;
}

export interface CreateInstanceResult {
  serverId: string;
  zone: string;
  publicIp: string | null;
}

export interface InstanceStatus {
  state: ScalewayServerState;
  publicIp: string | null;
}
