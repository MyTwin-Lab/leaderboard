import type { PlatformDefinitions } from '../../../../packages/registry/platform';
import { codeFlow } from '../../../../content/flows/code';
import { mlFlow } from '../../../../content/flows/ml';
import { validationFlow } from '../../../../content/flows/validation';
import { slackSignalsExtension } from '../../../../content/extensions/slack-signals';
import { computeExtension } from '../../../../content/extensions/compute';

/**
 * Distribution MyTwin — plateforme
 * --------------------------------
 * Les flows et extensions installés, avec ce qu'ils écrivent dans le ledger et
 * dans `contributions`. Séparé de `mytwin.server.ts` pour pouvoir être vérifié
 * sans charger les connecteurs ni leurs credentials.
 */
export const platform: PlatformDefinitions = {
  flows: [codeFlow, mlFlow, validationFlow],
  extensions: [slackSignalsExtension, computeExtension],
};
