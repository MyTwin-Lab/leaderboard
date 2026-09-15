import type { ProfileAggregateChip } from "../../../packages/registry/platform.js";

export const SLACK_SIGNAL_RULE_KEY = "slack_signal";

/**
 * Les signaux d'un contributeur sur un challenge, en chips : combien de fois
 * chaque signal a été détecté et ce qu'il a rapporté. Les libellés viennent des
 * définitions du challenge, avec repli sur le libellé historisé dans le ledger
 * si le signal a été supprimé depuis.
 */
export async function summarizeSignals({
  challengeId,
  contributionId,
}: {
  challengeId: string;
  contributionId: string;
}): Promise<ProfileAggregateChip[]> {
  // Import à la demande : déclarer l'extension ne doit pas ouvrir la base.
  const { RewardEntryRepository, ChallengeSignalRepository } = await import(
    "../../../packages/database-service/repositories/index.js"
  );
  const [ledgerEntries, definitions] = await Promise.all([
    new RewardEntryRepository().findByContribution(contributionId),
    new ChallengeSignalRepository().findByChallenge(challengeId),
  ]);
  const definitionById = new Map(definitions.map((definition) => [definition.uuid, definition]));

  const bySignal = new Map<string, ProfileAggregateChip>();
  for (const entry of ledgerEntries) {
    if (entry.rule_key !== SLACK_SIGNAL_RULE_KEY) continue;
    const signalId = String(entry.meta?.signal_id ?? "unknown");
    const definition = definitionById.get(signalId);
    const chip = bySignal.get(signalId) ?? {
      id: signalId,
      label: definition?.label ?? String(entry.meta?.signal_label ?? "Signal"),
      icon: definition?.icon ?? null,
      count: 0,
      totalCp: 0,
    };
    chip.count += 1;
    chip.totalCp += entry.points;
    bySignal.set(signalId, chip);
  }

  return [...bySignal.values()].sort((a, b) => b.totalCp - a.totalCp);
}
