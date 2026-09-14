import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  CaseClaimRepository: class {},
  ReferenceCaseRepository: class {},
  RefreshTokenRepository: class {},
  SandboxStarRepository: class {},
}));

import { runRetentionPurges, validationContentRetentionCutoff } from './retention';

const NOW = new Date('2026-09-14T03:00:00.000Z');

function makeDeps() {
  return {
    refreshTokenRepo: { cleanupExpired: vi.fn(async () => 4) },
    starRepo: { purgeIpHashesOlderThan: vi.fn(async (_cutoff: Date) => 7) },
    referenceCaseRepo: { purgeBytesForChallengesClosedBefore: vi.fn(async (_cutoff: Date) => 2) },
    caseClaimRepo: { purgeBytesForChallengesClosedBefore: vi.fn(async (_cutoff: Date) => 5) },
    now: () => NOW,
  };
}

describe('validationContentRetentionCutoff', () => {
  it('recule de 12 mois', () => {
    expect(validationContentRetentionCutoff(NOW).toISOString()).toBe('2025-09-14T03:00:00.000Z');
  });
});

describe('runRetentionPurges', () => {
  it('nettoie les refresh tokens expirés, les hachés IP de plus de 30 jours et les pièces à 12 mois', async () => {
    const deps = makeDeps();

    const result = await runRetentionPurges(deps);

    expect(result).toEqual({
      expiredRefreshTokens: 4,
      purgedIpHashes: 7,
      purgedReferenceCases: 2,
      purgedCaseClaims: 5,
    });
    expect(deps.refreshTokenRepo.cleanupExpired).toHaveBeenCalledTimes(1);
    expect(deps.starRepo.purgeIpHashesOlderThan.mock.calls[0][0].toISOString()).toBe('2026-08-15T03:00:00.000Z');
    expect(deps.referenceCaseRepo.purgeBytesForChallengesClosedBefore.mock.calls[0][0].toISOString()).toBe(
      '2025-09-14T03:00:00.000Z'
    );
    expect(deps.caseClaimRepo.purgeBytesForChallengesClosedBefore.mock.calls[0][0].toISOString()).toBe(
      '2025-09-14T03:00:00.000Z'
    );
  });

  it("isole les échecs : une purge qui lève n'empêche pas les autres", async () => {
    const deps = makeDeps();
    deps.refreshTokenRepo.cleanupExpired.mockRejectedValueOnce(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runRetentionPurges(deps);

    expect(result.expiredRefreshTokens).toBeNull();
    expect(result.purgedIpHashes).toBe(7);
    expect(result.purgedReferenceCases).toBe(2);
    expect(result.purgedCaseClaims).toBe(5);
    errorSpy.mockRestore();
  });
});
