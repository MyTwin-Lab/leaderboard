import {
  CaseClaimRepository,
  ReferenceCaseRepository,
  RefreshTokenRepository,
  SandboxStarRepository,
} from '../../../../../../../packages/database-service/repositories';
import { ipHashRetentionCutoff } from '../../../../../../../packages/services/sandbox/starPolicy';

/**
 * Purges de conservation quotidiennes
 * -----------------------------------
 * Branchées sur le cron `digest`, le seul qui tourne tous les jours quel que
 * soit le réglage du digest : un cron de plus serait un composant de plus à
 * planifier et à surveiller.
 *
 * Chaque purge est isolée : un échec est journalisé et remonté dans le
 * résultat, sans empêcher les autres purges ni la génération du digest.
 */

/** Pièces des challenges de validation conservées 12 mois après la fermeture (politique §4.2). */
export const VALIDATION_CONTENT_RETENTION_MONTHS = 12;

/** Date avant laquelle un challenge de validation fermé voit ses pièces purgées. */
export function validationContentRetentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - VALIDATION_CONTENT_RETENTION_MONTHS);
  return cutoff;
}

export interface RetentionDeps {
  refreshTokenRepo: Pick<RefreshTokenRepository, 'cleanupExpired'>;
  starRepo: Pick<SandboxStarRepository, 'purgeIpHashesOlderThan'>;
  referenceCaseRepo: Pick<ReferenceCaseRepository, 'purgeBytesForChallengesClosedBefore'>;
  caseClaimRepo: Pick<CaseClaimRepository, 'purgeBytesForChallengesClosedBefore'>;
  now: () => Date;
}

/** Nombre de lignes touchées par purge, ou `null` si la purge a échoué. */
export interface RetentionResult {
  expiredRefreshTokens: number | null;
  purgedIpHashes: number | null;
  purgedReferenceCases: number | null;
  purgedCaseClaims: number | null;
}

async function safely(label: string, run: () => Promise<number>): Promise<number | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[Cron] Retention purge "${label}" failed:`, error);
    return null;
  }
}

export async function runRetentionPurges(deps?: Partial<RetentionDeps>): Promise<RetentionResult> {
  const d: RetentionDeps = {
    refreshTokenRepo: deps?.refreshTokenRepo ?? new RefreshTokenRepository(),
    starRepo: deps?.starRepo ?? new SandboxStarRepository(),
    referenceCaseRepo: deps?.referenceCaseRepo ?? new ReferenceCaseRepository(),
    caseClaimRepo: deps?.caseClaimRepo ?? new CaseClaimRepository(),
    now: deps?.now ?? (() => new Date()),
  };
  const now = d.now();
  const validationCutoff = validationContentRetentionCutoff(now);

  const expiredRefreshTokens = await safely('refresh tokens', () => d.refreshTokenRepo.cleanupExpired());
  // Même règle de 30 jours que la purge opportuniste de SandboxService.star :
  // sans vote, les hachés dépasseraient sinon la durée annoncée.
  const purgedIpHashes = await safely('ip hashes', () =>
    d.starRepo.purgeIpHashesOlderThan(ipHashRetentionCutoff(now))
  );
  const purgedCaseClaims = await safely('validation case claims', () =>
    d.caseClaimRepo.purgeBytesForChallengesClosedBefore(validationCutoff)
  );
  const purgedReferenceCases = await safely('validation reference cases', () =>
    d.referenceCaseRepo.purgeBytesForChallengesClosedBefore(validationCutoff)
  );

  return { expiredRefreshTokens, purgedIpHashes, purgedReferenceCases, purgedCaseClaims };
}
