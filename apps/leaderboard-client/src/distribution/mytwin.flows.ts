import { createFlowCatalog } from '../../../../packages/registry/flows';
import { codeFlowDescriptor } from '../../../../content/flows/code/descriptor';
import { mlFlowDescriptor } from '../../../../content/flows/ml/descriptor';
import { validationFlowDescriptor } from '../../../../content/flows/validation/descriptor';

/**
 * Distribution MyTwin — catalogue des flows
 * -----------------------------------------
 * Les descripteurs des flows installés, lus par le client comme par le
 * serveur : noms, icônes, brief et visibilité publique. Données pures.
 *
 * `code` est le flow d'un challenge sans type, comme le défaut de la colonne
 * `challenges.type`.
 */
export const flowCatalog = createFlowCatalog(
  [codeFlowDescriptor, mlFlowDescriptor, validationFlowDescriptor],
  { defaultKey: 'code' },
);
