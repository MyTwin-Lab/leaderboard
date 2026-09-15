import type { KitDefinition } from "../../../packages/registry/platform.js";

export { cpPerValidationSchema, quorumSchema, validationConfigOf, type ValidationPayout } from "./config.js";

/**
 * Kit validation — ce que les flows de validation partagent :
 * - la clé de ledger `validation`, payée au forfait `cp_per_validation` sur le pool ;
 * - la contribution d'agrégat `validation` d'un validateur (`validatorContribution.ts`) ;
 * - les schémas de configuration du forfait et du quorum (`config.ts`).
 *
 * La clé et le type de contribution sont déclarés ici, une seule fois : deux
 * flows qui les déclareraient chacun feraient échouer l'installation.
 */
export const validationKit: KitDefinition = {
  key: "validation",
  ruleKeys: [{ key: "validation", consumesPool: true }],
  contributionTypes: [{ key: "validation", countsAsContribution: true }],
};
