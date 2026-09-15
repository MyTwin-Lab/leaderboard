import type { PlatformDefinitions } from '../../../../packages/registry/platform';
import { codeFlow } from '../../../../content/flows/code';
import { mlFlow } from '../../../../content/flows/ml';
import { endpointValidationFlow } from '../../../../content/flows/endpoint-validation';
import { journeyValidationFlow } from '../../../../content/flows/journey-validation';
import { validationKit } from '../../../../content/kits/validation';
import { slackSignalsExtension } from '../../../../content/extensions/slack-signals';
import { computeExtension } from '../../../../content/extensions/compute';
import { sandboxModule } from '../../../../modules/sandbox';
import { meetingsModule } from '../../../../modules/meetings';
import { digestModule } from '../../../../modules/digest';
import { onboardingModule } from '../../../../modules/onboarding';

/** La qualification des professionnels de santé, exigée par les validations MyTwin. */
export const MEDICAL_PRO = 'medical_pro';

/**
 * Distribution MyTwin — plateforme
 * --------------------------------
 * Les flows, extensions et modules installés, avec ce qu'ils écrivent dans le
 * ledger et dans `contributions`. Séparé de `mytwin.server.ts` pour pouvoir
 * être vérifié sans charger les connecteurs ni leurs credentials.
 */
export const platform: PlatformDefinitions = {
  flows: [
    codeFlow,
    mlFlow,
    // Les validations MyTwin sont jugées par des professionnels de santé.
    { ...endpointValidationFlow, configDefaults: { reviewer_qualification: MEDICAL_PRO } },
    { ...journeyValidationFlow, configDefaults: { expert_comment_qualification: MEDICAL_PRO } },
  ],
  kits: [validationKit],
  extensions: [slackSignalsExtension, computeExtension],
  modules: [sandboxModule, meetingsModule, digestModule, onboardingModule],
  qualifications: [
    {
      key: MEDICAL_PRO,
      label: 'Health professional',
      description: 'A health professional whose qualification an admin has checked.',
    },
  ],
};
