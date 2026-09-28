import { PlatformRegistry } from "../registry/platform.js";

/**
 * Capacité `deliverables`
 * -----------------------
 * Un flow déclare ses livrables (un type de contribution et ce qu'il permet
 * d'éprouver) ; un flow de validation déclare la capacité qu'il exige d'un
 * challenge parent. La rencontre des deux dit quelles contributions peuvent
 * devenir des cibles — sans que la validation connaisse le flow source, ni
 * l'inverse. Un flow personnalisé qui produit une application déployée
 * devient ainsi parcourable sans rien changer à la validation.
 */

/** La capacité qu'un flow exige de son challenge parent, s'il en a un. */
export function requiredDeliverableCapability(flowKey: string | null | undefined): string | undefined {
  return PlatformRegistry.flow(flowKey)?.requires?.deliverableCapability;
}

/** Le flow éprouve les livrables d'un challenge parent. */
export function requiresDeliverable(flowKey: string | null | undefined): boolean {
  return !!requiredDeliverableCapability(flowKey);
}

/**
 * Le type de contribution du challenge source que ce flow peut prendre pour
 * cible, ou `null` quand le source n'offre pas la capacité exigée.
 */
export function eligibleDeliverableType(flowKey: string, sourceFlowKey: string | null | undefined): string | null {
  const capability = requiredDeliverableCapability(flowKey);
  if (!capability) return null;
  const deliverable = PlatformRegistry.flow(sourceFlowKey)?.deliverables?.find((candidate) =>
    candidate.capabilities.includes(capability)
  );
  return deliverable?.contributionType ?? null;
}

/** Les flows installés qui peuvent éprouver les livrables d'un challenge de ce flow. */
export function flowsValidating(sourceFlowKey: string | null | undefined): string[] {
  const offered = new Set(
    (PlatformRegistry.flow(sourceFlowKey)?.deliverables ?? []).flatMap((deliverable) => deliverable.capabilities)
  );
  return PlatformRegistry.flows()
    .filter((flow) => flow.requires && offered.has(flow.requires.deliverableCapability))
    .map((flow) => flow.descriptor.key);
}
