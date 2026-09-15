import {
  PlatformRegistry,
  type CpSourceEntry,
  type ProfileAggregate,
} from "../registry/platform.js";

/**
 * Économie de la plateforme
 * -------------------------
 * Ce que le classement, l'accueil et les profils lisent des déclarations des
 * flows, extensions et modules installés — pour ne jamais nommer un type de
 * contribution ou une clé de ledger eux-mêmes.
 */

/**
 * Un type de contribution compte-t-il comme une contribution de plus ? Un type
 * que rien ne déclare compte, comme avant toute déclaration.
 */
export function countsAsContribution(type: string): boolean {
  return PlatformRegistry.contributionType(type)?.countsAsContribution ?? true;
}

/** Le résumé de profil d'un type agrégat, s'il en déclare un. */
export function profileAggregateOf(type: string): ProfileAggregate | undefined {
  return PlatformRegistry.contributionType(type)?.profileAggregate;
}

/**
 * Le libellé d'une ligne de ledger : celui que la ligne porte (tiré de son
 * `meta`), sinon celui de sa clé, sinon la clé brute.
 */
export function ruleKeyLabel(ruleKey: string, meta?: Record<string, unknown> | null): string {
  const declaration = PlatformRegistry.ruleKey(ruleKey);
  return declaration?.describe?.(meta ?? undefined) ?? declaration?.label ?? ruleKey;
}

/** Toutes les lignes de CP gagnées hors challenge, toutes sources installées confondues. */
export async function listExternalRewards(): Promise<CpSourceEntry[]> {
  const lists = await Promise.all(PlatformRegistry.cpSources().map((source) => source.listAll()));
  return lists.flat();
}
