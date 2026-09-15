import type { PlatformDefinitions } from '../../../../packages/registry/platform';
import { codeFlow } from '../../../../content/flows/code';
import { mlFlow } from '../../../../content/flows/ml';
import { endpointValidationFlow } from '../../../../content/flows/endpoint-validation';
import { journeyValidationFlow } from '../../../../content/flows/journey-validation';
import { validationKit } from '../../../../content/kits/validation';
import { slackSignalsExtension } from '../../../../content/extensions/slack-signals';
import { computeExtension } from '../../../../content/extensions/compute';
import { sandboxModule } from '../../../../modules/sandbox';

/**
 * Distribution MyTwin — plateforme
 * --------------------------------
 * Les flows, extensions et modules installés, avec ce qu'ils écrivent dans le
 * ledger et dans `contributions`. Séparé de `mytwin.server.ts` pour pouvoir
 * être vérifié sans charger les connecteurs ni leurs credentials.
 */
export const platform: PlatformDefinitions = {
  flows: [codeFlow, mlFlow, endpointValidationFlow, journeyValidationFlow],
  kits: [validationKit],
  extensions: [slackSignalsExtension, computeExtension],
  modules: [sandboxModule],
};
