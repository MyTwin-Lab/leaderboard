import { PlatformRegistry, type ProposableDeclaration } from "../../registry/platform.js";
import type { Sandbox } from "../../database-service/domain/entities.js";
import { proposalFieldsFromLegacyColumns } from "../../database-service/domain/legacyProposalFields.js";
import { SANDBOX_COMMON_KEYS } from "../../database-service/domain/schemas_zod.js";

/**
 * Propositions — le lien entre un sandbox et son flow
 * ---------------------------------------------------
 * `sandboxes.type` est la clé d'un flow qui déclare `proposable`. Ce que la
 * proposition porte, comment elle s'évalue et ce que devient sa promotion, c'est
 * cette déclaration qui le dit : aucun service sandbox ne connaît `code` ni `ml`.
 */

/** Les champs de la proposition ne passent pas le schéma de son flow, ou le flow n'en accepte pas. → 400 */
export class InvalidProposalError extends Error {
  constructor(message: string, readonly details: unknown) {
    super(message);
  }
}

/** Le flow du sandbox n'est plus installé ou n'accepte plus de propositions. → 409 */
export class SandboxFlowUnavailableError extends Error {}

/** La déclaration `proposable` d'un flow installé, `undefined` sinon. */
export function installedProposable(flowKey: string): ProposableDeclaration | undefined {
  return PlatformRegistry.isInstalled() ? PlatformRegistry.flow(flowKey)?.proposable : undefined;
}

/** Les champs d'un sandbox : le jsonb, ou les anciennes colonnes pour une ligne qui ne le porte pas. */
export function proposalFieldsOf(
  sandbox: Pick<Sandbox, "repo_url" | "model_url" | "dataset_urls" | "proposal_fields">,
): Record<string, unknown> {
  return sandbox.proposal_fields ?? proposalFieldsFromLegacyColumns(sandbox);
}

/** Les champs de proposition d'un corps de requête : tout ce qui n'est pas commun à tous les sandboxes. */
export function proposalFieldsInput(body: Record<string, unknown>): Record<string, unknown> {
  const common = new Set<string>(SANDBOX_COMMON_KEYS);
  return Object.fromEntries(Object.entries(body).filter(([key]) => !common.has(key)));
}

function detailsOf(error: unknown): unknown {
  const flatten = (error as { flatten?: () => unknown } | null)?.flatten;
  if (typeof flatten === "function") return flatten.call(error);
  return { formErrors: [error instanceof Error ? error.message : String(error)], fieldErrors: {} };
}

/** Valide des champs avec le schéma du flow, et rend les champs à stocker. */
export function parseProposalFields(proposable: ProposableDeclaration, raw: unknown): Record<string, unknown> {
  try {
    return proposable.fields.parse(raw);
  } catch (error) {
    throw new InvalidProposalError("Invalid proposal fields", detailsOf(error));
  }
}
