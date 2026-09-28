import { CaseClaimRepository, ReferenceCaseRepository } from "../../../packages/database-service/repositories/index.js";

/** Pièces des challenges de validation conservées 12 mois après la fermeture (politique §4.2). */
export const VALIDATION_CONTENT_RETENTION_MONTHS = 12;

/** Date avant laquelle un challenge de validation fermé voit ses pièces purgées. */
export function validationContentRetentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - VALIDATION_CONTENT_RETENTION_MONTHS);
  return cutoff;
}

export interface EvidencePurgeDeps {
  referenceCaseRepo: Pick<ReferenceCaseRepository, "purgeBytesForChallengesClosedBefore">;
  caseClaimRepo: Pick<CaseClaimRepository, "purgeBytesForChallengesClosedBefore">;
  now: () => Date;
}

export interface EvidencePurgeResult {
  /** Lignes purgées, ou `null` quand la purge a échoué. */
  purgedCaseClaims: number | null;
  purgedReferenceCases: number | null;
}

async function safely(label: string, run: () => Promise<number>): Promise<number | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[endpoint-validation] Evidence purge "${label}" failed:`, error);
    return null;
  }
}

/**
 * Efface les octets des réponses réclamées et des cas de référence des
 * challenges fermés depuis 12 mois. Les deux purges sont isolées ; si l'une
 * échoue, le job est marqué en échec pour que `cron_runs` le montre.
 */
export async function purgeValidationEvidence(deps?: Partial<EvidencePurgeDeps>): Promise<EvidencePurgeResult> {
  const referenceCaseRepo = deps?.referenceCaseRepo ?? new ReferenceCaseRepository();
  const caseClaimRepo = deps?.caseClaimRepo ?? new CaseClaimRepository();
  const cutoff = validationContentRetentionCutoff(deps?.now?.() ?? new Date());

  const result: EvidencePurgeResult = {
    purgedCaseClaims: await safely("case claims", () => caseClaimRepo.purgeBytesForChallengesClosedBefore(cutoff)),
    purgedReferenceCases: await safely("reference cases", () =>
      referenceCaseRepo.purgeBytesForChallengesClosedBefore(cutoff)),
  };
  if (result.purgedCaseClaims === null || result.purgedReferenceCases === null) {
    throw new Error(`Validation evidence purge incomplete: ${JSON.stringify(result)}`);
  }
  return result;
}
