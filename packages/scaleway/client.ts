import type { CreateInstanceParams, CreateInstanceResult, InstanceStatus } from './types.js';

/**
 * Minimal cloud-init: only GPU drivers + a working Python/Jupyter env are
 * expected to already be on the marketplace image (see SPEC §4.4 — no ML
 * library is imposed). This just installs jupyterlab and starts it with the
 * access token the app generated, so the contributor never has to touch
 * infrastructure setup.
 */
function buildCloudInit(accessToken: string): string {
  return [
    '#!/bin/bash',
    'pip install --quiet jupyterlab',
    `nohup jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --NotebookApp.token='${accessToken}' > /var/log/jupyter.log 2>&1 &`,
  ].join('\n');
}

/**
 * Thin wrapper over the Scaleway Instance API. Kept separate from
 * ScalewayGpuProvider (packages/provisioner) so it can also be used
 * standalone for the admin connection test, independent of the
 * WorkspaceProvider contract.
 */
export class ScalewayClient {
  constructor(private secretKey: string, private projectId: string) {}

  private async request(zone: string, path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`https://api.scaleway.com/instance/v1/zones/${zone}${path}`, {
      ...init,
      headers: {
        'X-Auth-Token': this.secretKey,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Scaleway API error ${res.status}: ${res.statusText} (${path}) ${body}`.trim());
    }
    return res.status === 204 ? null : res.json();
  }

  async testConnection(zone: string): Promise<boolean> {
    try {
      await this.request(zone, '/servers?per_page=1');
      return true;
    } catch {
      return false;
    }
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    const created = await this.request(params.zone, '/servers', {
      method: 'POST',
      body: JSON.stringify({
        project: this.projectId,
        name: params.name,
        commercial_type: params.commercialType,
        image: params.imageId,
        dynamic_ip_required: true,
      }),
    });
    const serverId: string = created.server.id;

    await this.request(params.zone, `/servers/${serverId}/user_data/cloud-init`, {
      method: 'PATCH',
      body: buildCloudInit(params.cloudInitAccessToken),
      headers: { 'Content-Type': 'text/plain' },
    });

    await this.request(params.zone, `/servers/${serverId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'poweron' }),
    });

    return {
      serverId,
      zone: params.zone,
      publicIp: created.server.public_ip?.address ?? null,
    };
  }

  async getInstance(zone: string, serverId: string): Promise<InstanceStatus> {
    const data = await this.request(zone, `/servers/${serverId}`);
    return {
      state: data.server.state,
      publicIp: data.server.public_ip?.address ?? null,
    };
  }

  async terminateInstance(zone: string, serverId: string): Promise<void> {
    await this.request(zone, `/servers/${serverId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'terminate' }),
    });
  }
}
