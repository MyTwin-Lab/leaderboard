import type { KitDefinition } from "../../../packages/registry/platform.js";

export {
  cpPerValidationSchema,
  quorumSchema,
  reviewerQualificationOf,
  validationConfigOf,
  type ValidationPayout,
} from "./config.js";
export { validationModeOf, type ValidationMode } from "./mode.js";
export { VALIDATION_MANAGERS, validationKitActions } from "./actions/index.js";

/**
 * Kit validation — ce que les flows de validation partagent :
 * - la clé de ledger `validation`, payée au forfait `cp_per_validation` sur le pool ;
 * - la contribution d'agrégat `validation` d'un validateur (`validatorContribution.ts`) ;
 * - les schémas de configuration du forfait et du quorum (`config.ts`) ;
 * - les actions sur les cibles et les récompenses (`actions/`), que chaque flow
 *   de validation reprend dans les siennes.
 *
 * La clé et le type de contribution sont déclarés ici, une seule fois : deux
 * flows qui les déclareraient chacun feraient échouer l'installation.
 */
export const validationKit: KitDefinition = {
  key: "validation",
  ruleKeys: [{ key: "validation", consumesPool: true }],
  contributionTypes: [{ key: "validation", countsAsContribution: true }],
};
