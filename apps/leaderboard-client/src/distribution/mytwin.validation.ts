import { ENDPOINT_VALIDATION_FLOW_KEY } from '../../../../content/flows/endpoint-validation/descriptor';
import { JOURNEY_VALIDATION_FLOW_KEY } from '../../../../content/flows/journey-validation/descriptor';

/**
 * Distribution MyTwin — flows de validation côté shell
 * ----------------------------------------------------
 * Les écrans et les routes du shell branchent encore sur « est-ce une
 * validation, et de quelle sorte ». Ils le demandent ici plutôt que de
 * connaître les clés de flow ; les slots et les actions de flow du lot L4 du
 * challenge 020 remplacent ces questions.
 *
 * Données pures : utilisable côté client comme côté serveur.
 */

export type ValidationMode = 'reference_case' | 'scenario';

const MODES: Record<string, ValidationMode> = {
  [ENDPOINT_VALIDATION_FLOW_KEY]: 'reference_case',
  [JOURNEY_VALIDATION_FLOW_KEY]: 'scenario',
};

/** Un challenge de validation : endpoints éprouvés contre des cas de référence, ou parcours de scénario. */
export function validationModeOf(type: string | null | undefined): ValidationMode | null {
  return (type && MODES[type]) || null;
}

export function isValidationFlow(type: string | null | undefined): boolean {
  return validationModeOf(type) !== null;
}

/**
 * L'entrée du sélecteur de type des formulaires. Un seul choix « validation »
 * couvre les deux flows : la route de création déduit le flow des livrables du
 * challenge source.
 */
export function formTypeOf(type: string | null | undefined): 'code' | 'ml' | 'validation' {
  if (type === 'ml') return 'ml';
  return isValidationFlow(type) ? 'validation' : 'code';
}
