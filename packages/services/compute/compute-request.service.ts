import {
  ComputeRequestRepository,
  ChallengeRepository,
  ChallengeTeamRepository,
} from '../../database-service/repositories/index.js';
import type { ComputeRequest, ComputeRequestExpireReason } from '../../database-service/domain/entities.js';
import { encryptToken, decryptToken } from '../../config/githubToken.js';
import { isScalewayUserFacingConnected } from '../../config/scalewayCredentials.js';
import { getScalewayProvider } from './scaleway-provider.helper.js';

export type RequestComputeResult = { request: ComputeRequest } | { error: 'not_ml_challenge' | 'scaleway_not_connected' | 'already_requested' };

export class ComputeRequestService {
  private repo = new ComputeRequestRepository();
  private challengeRepo = new ChallengeRepository();
  private teamRepo = new ChallengeTeamRepository();

  async requestCompute(challengeId: string, userId: string): Promise<RequestComputeResult> {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'ml') return { error: 'not_ml_challenge' };
    if (!(await isScalewayUserFacingConnected())) return { error: 'scaleway_not_connected' };

    // Comme pour la soumission ML (ml-workspace/route.ts), demander de la
    // puissance de calcul rend le contributeur membre du challenge s'il ne
    // l'était pas déjà — il n'y a pas d'autre porte d'entrée obligatoire sur
    // un challenge ML.
    const existingTeam = await this.teamRepo.findByChallenge(challengeId);
    if (!existingTeam.some(m => m.user_id === userId)) {
      await this.teamRepo.create({ challenge_id: challengeId, user_id: userId });
    }

    const request = await this.repo.create({ challenge_id: challengeId, user_id: userId });
    if (!request) return { error: 'already_requested' };
    return { request };
  }

  async decide(requestId: string, deciderId: string, decision: 'approve' | 'reject'): Promise<ComputeRequest> {
    const existing = await this.repo.findById(requestId);
    if (!existing) throw new Error('Compute request not found');
    if (existing.status !== 'pending') throw new Error(`Cannot decide a request in status "${existing.status}"`);

    if (decision === 'reject') {
      await this.repo.updateRejected(requestId, deciderId);
    } else {
      await this.repo.updateApproved(requestId, deciderId);
      // Fire-and-forget : la création peut prendre de quelques secondes à
      // plusieurs minutes, largement au-delà du budget de cette requête HTTP.
      // La progression est suivie via le statut de la demande, pollé par le cron.
      this.startProvisioning(requestId).catch(err => {
        console.error(`[ComputeRequestService] startProvisioning failed for ${requestId}:`, err);
        this.repo.updateFailed(requestId, err?.message ?? 'Unknown provisioning error').catch(() => {});
      });
    }

    const updated = await this.repo.findById(requestId);
    if (!updated) throw new Error('Compute request disappeared after decision');
    return updated;
  }

  async startProvisioning(requestId: string): Promise<void> {
    const request = await this.repo.findById(requestId);
    if (!request) throw new Error('Compute request not found');

    const provider = await getScalewayProvider();
    if (!provider) {
      await this.repo.updateFailed(requestId, 'Scaleway non connecté — contactez un admin.');
      return;
    }

    const result = await provider.provision({
      workspaceType: 'gpu_instance',
      parentRef: '', // resolved internally by the provider from its own credentials
      name: `gpu-${request.challenge_id.slice(0, 8)}-${request.user_id.slice(0, 8)}`,
    });

    if (result.status === 'failed' || !result.secret) {
      await this.repo.updateFailed(requestId, result.error ?? 'Échec de la création de l\'instance');
      return;
    }

    const { enc, iv } = encryptToken(result.secret);
    await this.repo.updateProvisioningStarted(requestId, {
      provider_ref: result.ref,
      provider_parent_ref: (result.meta?.zone as string) ?? '',
      access_token_enc: enc,
      access_token_iv: iv,
    });
  }

  /** Relance le provisioning sur une demande en échec — pas de nouvelle ligne créée. */
  async retryProvisioning(requestId: string): Promise<void> {
    const request = await this.repo.findById(requestId);
    if (!request) throw new Error('Compute request not found');
    if (request.status !== 'failed') throw new Error(`Cannot retry a request in status "${request.status}"`);
    await this.startProvisioning(requestId);
  }

  /** Pollée par le cron de provisioning — fait avancer provisioning -> ready|failed. */
  async pollProvisioning(): Promise<void> {
    const provider = await getScalewayProvider();
    const inProgress = await this.repo.findProvisioningInProgress();

    for (const request of inProgress) {
      if (!provider || !request.provider_ref) continue;
      try {
        const status = await provider.getStatus('', request.provider_ref);
        if (status === 'ready') {
          // provider_ref only carries "zone/serverId" — the reachable URL
          // isn't persisted from provision(), so it's re-derived here via a
          // fresh getInstance() call once the instance is confirmed ready.
          const jupyterBaseUrl = await this.resolveJupyterUrl(request.provider_ref);
          await this.repo.updateReady(request.uuid, jupyterBaseUrl);
        } else if (status === 'failed') {
          await this.repo.updateFailed(request.uuid, 'La création de l\'instance a échoué côté Scaleway.');
        }
      } catch (error: any) {
        console.error(`[ComputeRequestService] pollProvisioning error for ${request.uuid}:`, error);
      }
    }
  }

  private async resolveJupyterUrl(providerRef: string): Promise<string> {
    const [zone, serverId] = providerRef.split('/');
    const creds = await (await import('../../config/scalewayCredentials.js')).getScalewayCredentials();
    if (!creds) return '';
    const { ScalewayClient } = await import('../../scaleway/index.js');
    const client = new ScalewayClient(creds.secretKey, creds.projectId);
    const { publicIp } = await client.getInstance(zone, serverId);
    return publicIp ? `http://${publicIp}:8888` : '';
  }

  /**
   * Pollée par le cron d'expiration — coupe toute demande 'ready' dont les
   * 24h sont dépassées. La coupure applicative (updateExpired) ne doit
   * jamais rester bloquée par un échec de l'appel API Scaleway.
   */
  async sweepExpired(): Promise<void> {
    const now = new Date();
    const expired = await this.repo.findExpiredPending(now);
    const provider = await getScalewayProvider();

    for (const request of expired) {
      if (provider && request.provider_ref) {
        try {
          await provider.deprovision('', request.provider_ref);
        } catch (error) {
          console.error(`[ComputeRequestService] deprovision failed for ${request.uuid}:`, error);
        }
      }
      await this.repo.updateExpired(request.uuid, 'timeout');
    }
  }

  /** Coupure immédiate (clôture ou suppression de challenge) — même logique best-effort que sweepExpired. */
  async terminateForChallenge(challengeId: string, reason: ComputeRequestExpireReason): Promise<void> {
    const active = await this.repo.findActiveForChallenge(challengeId);
    if (active.length === 0) return;
    const provider = await getScalewayProvider();

    for (const request of active) {
      if (provider && request.provider_ref) {
        try {
          await provider.deprovision('', request.provider_ref);
        } catch (error) {
          console.error(`[ComputeRequestService] deprovision failed for ${request.uuid}:`, error);
        }
      }
      await this.repo.updateExpired(request.uuid, reason);
    }
  }

  /**
   * Révèle le jeton d'accès au contributeur propriétaire. Consultable tant
   * que l'instance est 'ready' (pas de burn-after-read) — décision produit :
   * un jeton détruit après une seule lecture bloquerait définitivement un
   * contributeur qui perd l'onglet ou rafraîchit avant de l'avoir noté.
   */
  async revealToken(requestId: string, userId: string): Promise<{ token: string; jupyterUrl: string }> {
    const request = await this.repo.findById(requestId);
    if (!request || request.user_id !== userId) throw new Error('Compute request not found');
    if (request.status !== 'ready') throw new Error(`Cannot reveal token for a request in status "${request.status}"`);
    if (!request.access_token_enc || !request.access_token_iv) throw new Error('No access token stored for this request');

    const token = decryptToken(request.access_token_enc, request.access_token_iv);
    await this.repo.markTokenRevealed(requestId);
    return { token, jupyterUrl: request.jupyter_base_url ?? '' };
  }
}
