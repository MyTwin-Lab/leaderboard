// packages/provisioner/src/providers/scaleway-gpu.provider.ts

import crypto from 'node:crypto';
import { ScalewayClient } from '../../../scaleway/index.js';
import type { WorkspaceProvider, ProvisionRequest, ProvisionResult, WorkspaceStatus } from '../types.js';
import { ProviderAuthenticationError, MissingConfigurationError } from '../errors.js';

export interface ScalewayGpuCredentials {
  secretKey: string;
  projectId: string;
  zone: string;
}

/**
 * Provider pour créer des instances GPU Scaleway (notebooks Jupyter éphémères).
 *
 * Contrairement à GitHubBranchProvider, les credentials viennent de la DB
 * (app_settings), pas d'une variable d'environnement statique lue au
 * démarrage du process — le constructeur les reçoit explicitement, et
 * l'appelant est responsable de reconstruire/ré-enregistrer ce provider à
 * chaque usage (voir packages/services/compute/scaleway-provider.helper.ts).
 *
 * protect() n'est pas implémenté : le jeton d'accès one-shot à l'instance
 * n'est pas une restriction "par liste d'utilisateurs" comme la protection
 * de branche Git, c'est un secret émis directement par provision() via le
 * champ ProvisionResult.secret.
 */
export class ScalewayGpuProvider implements WorkspaceProvider {
  readonly type = 'gpu_instance' as const;
  readonly name = 'Scaleway GPU';

  private client: ScalewayClient;

  constructor(private credentials: ScalewayGpuCredentials) {
    if (!credentials?.secretKey) {
      throw new MissingConfigurationError('scaleway_secret_key');
    }
    this.client = new ScalewayClient(credentials.secretKey, credentials.projectId);
  }

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    const accessToken = crypto.randomBytes(24).toString('hex');

    try {
      const { serverId, zone, publicIp } = await this.client.createInstance({
        zone: this.credentials.zone,
        projectId: this.credentials.projectId,
        name: request.name,
        // TODO: confirmer le gabarit exact (SPEC §9 — cible 16Go VRAM, aucune
        // offre catalogue actuelle ne tombe pile dessus ; L4 24Go pressenti).
        commercialType: (request.options?.commercialType as string) ?? 'L4-1-24G',
        // TODO: UUID de l'image marketplace GPU/CUDA + Jupyter pour la zone cible.
        imageId: (request.options?.imageId as string) ?? '',
        cloudInitAccessToken: accessToken,
      });

      return {
        provider: this.name,
        workspaceType: this.type,
        ref: `${zone}/${serverId}`,
        url: publicIp ? `http://${publicIp}:8888` : '',
        // Création async côté Scaleway — la readiness réelle (cloud-init
        // terminé, Jupyter up) est confirmée par un poll ultérieur via getStatus().
        status: 'pending',
        secret: accessToken,
        meta: { zone, serverId },
      };
    } catch (error: any) {
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        throw new ProviderAuthenticationError(this.name, error.message);
      }
      return {
        provider: this.name,
        workspaceType: this.type,
        ref: '',
        url: '',
        status: 'failed',
        error: error?.message ?? 'Unknown error',
      };
    }
  }

  async getStatus(_parentRef: string, ref: string): Promise<WorkspaceStatus> {
    const [zone, serverId] = ref.split('/');
    if (!zone || !serverId) return 'failed';
    try {
      const { state } = await this.client.getInstance(zone, serverId);
      // Le state Scaleway "running" ne garantit pas que le cloud-init (install
      // + démarrage de Jupyter) est terminé — heuristique volontairement
      // simple en v1, à affiner (sonde HTTP sur le port Jupyter) si ça
      // s'avère peu fiable en pratique.
      if (state === 'running') return 'ready';
      if (state === 'error') return 'failed';
      return 'pending';
    } catch {
      return 'failed';
    }
  }

  async deprovision(_parentRef: string, ref: string): Promise<void> {
    const [zone, serverId] = ref.split('/');
    if (!zone || !serverId) return;
    await this.client.terminateInstance(zone, serverId);
  }
}
