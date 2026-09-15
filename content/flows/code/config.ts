import { z } from "zod";
import { flowConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";
import { parseCodeRewardRules } from "../../../packages/database-service/domain/codeRewardRules.js";

/**
 * Configuration du flow code, version 1.
 *
 * `workspace_mode` dit d'où vient le livrable évalué :
 * - `provided_repo` : le repo GitHub du challenge, une branche perso par contributeur ;
 * - `own_repo` : chaque contributeur fournit l'URL de son propre repo.
 */
export const codeFlowConfigSchema = z.object({
  workspace_mode: z.enum(["provided_repo", "own_repo"]).default("provided_repo"),
});

export type CodeFlowConfig = z.infer<typeof codeFlowConfigSchema>;

export const CODE_FLOW_CONFIG_VERSION = 1;

/** La configuration d'un challenge code ; le mode historique quand elle ne se lit pas. */
export function codeConfigOf(challenge: FlowConfigSource): CodeFlowConfig {
  const mode = flowConfigOf(challenge)?.workspace_mode;
  return { workspace_mode: mode === "own_repo" ? "own_repo" : "provided_repo" };
}

export const codeFlowRules = { parse: parseCodeRewardRules };
