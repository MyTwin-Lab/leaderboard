import type { GridSeed } from '../../../../packages/capabilities/grid-seeds';
import { codeGridSeed } from '../../../../content/grids/code';
import { modelGridSeed } from '../../../../content/grids/model';
import { datasetGridSeed } from '../../../../content/grids/dataset';

/**
 * Distribution MyTwin — grilles d'évaluation
 * ------------------------------------------
 * Les grilles qu'attendent les flows installés : `code` (flow code, code d'un
 * modèle ML, packaging d'API, sandbox) et `dataset` (flow ML). `model` n'est
 * lue par aucun rôle aujourd'hui — le modèle se note sur sa métrique Kaggle —
 * mais reste proposée aux admins, comme avant.
 *
 * Insérées en base si absentes par `npm run db:seed-grids`, au déploiement.
 */
export const gridSeeds: GridSeed[] = [codeGridSeed, modelGridSeed, datasetGridSeed];
