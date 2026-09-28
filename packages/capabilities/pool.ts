import { PlatformRegistry } from "../registry/platform.js";

/**
 * Pool d'un challenge
 * -------------------
 * Le pool d'un challenge (`contribution_points_reward`) se consomme par les
 * lignes du ledger dont la clé le déclare (`consumesPool`). Une récompense fixe
 * hors pool — un signal de discussion, par exemple — compte dans les CP de son
 * auteur, pas dans ce qui reste à distribuer.
 *
 * C'est le seul endroit qui dit ce que « distribué » veut dire : les services de
 * flows et le resync des caches lisent tous cette règle.
 */

/** Ce que le calcul lit du ledger. */
export interface PoolLedger {
  sumByChallenge(challengeId: string, opts?: { excludeRuleKeys?: string[] }): Promise<number>;
}

/** Les clés installées qui ne consomment pas le pool. Une clé non déclarée le consomme. */
export function outOfPoolRuleKeys(): string[] {
  return PlatformRegistry.ruleKeys()
    .filter((ruleKey) => !ruleKey.consumesPool)
    .map((ruleKey) => ruleKey.key);
}

/** Les points déjà pris sur le pool d'un challenge. */
export function distributedFromPool(ledger: PoolLedger, challengeId: string): Promise<number> {
  return ledger.sumByChallenge(challengeId, { excludeRuleKeys: outOfPoolRuleKeys() });
}

/** Ce qui reste à distribuer, jamais négatif. */
export function remainingPool(pool: number, distributed: number): number {
  return Math.max(0, pool - distributed);
}

/** La part du pool distribuée, de 0 à 1 ; 0 pour un challenge sans pool. */
export function poolCompletion(pool: number, distributed: number): number {
  return pool > 0 ? Math.min(1, distributed / pool) : 0;
}
